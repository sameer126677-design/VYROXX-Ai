import * as THREE from 'three';
import { AnimationScenePlan, is3DScenePlan } from '../shared/sceneSchema';
import { ExportConfig } from '../types';
import { fetchAuthenticatedAssetArrayBuffer } from '../lib/apiClient';
import { renderScenePlanFrame } from './safeRenderer';
import { ThreeSceneRuntime } from './three/ThreeSceneRuntime';

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  actualExtension: 'webm' | 'mp4' | 'gif';
  note?: string;
}

type FrameDrawer = (tSec: number) => void;

function createExportFrameDrawer(
  ctx: CanvasRenderingContext2D,
  plan: AnimationScenePlan,
  width: number,
  height: number,
  config: ExportConfig
): { drawFrame: FrameDrawer; dispose: () => void } {
  if (!is3DScenePlan(plan)) {
    return {
      drawFrame: (tSec: number) => {
        renderScenePlanFrame(ctx, plan, width, height, tSec, {
          overrideBackground: config.background,
        });
      },
      dispose: () => {},
    };
  }

  const glCanvas = document.createElement('canvas');
  glCanvas.width = width;
  glCanvas.height = height;
  const runtime = new ThreeSceneRuntime(plan, width, height, {
    fetchProtectedAssetBytes: fetchAuthenticatedAssetArrayBuffer,
  });
  runtime.attachRenderer(glCanvas, {
    preserveDrawingBuffer: true,
    alpha: config.background === 'Transparent',
  });

  if (config.background === 'Transparent') {
    runtime.scene.background = null;
    runtime.renderer?.setClearAlpha(0);
  }

  return {
    drawFrame: (tSec: number) => {
      runtime.seekTime(tSec);
      runtime.renderFrame();
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(glCanvas, 0, 0, width, height);
    },
    dispose: () => {
      runtime.dispose();
    },
  };
}

export async function exportRenderedAnimation(
  plan: AnimationScenePlan,
  config: ExportConfig,
  onProgress: (percent: number, stageLabel: string) => void,
  abortSignal?: AbortSignal
): Promise<ExportResult> {
  const width = Math.max(128, Math.min(3840, config.width));
  const height = Math.max(128, Math.min(2160, config.height));
  const fps =
    config.fpsPreset === 'Custom'
      ? Math.max(12, Math.min(60, config.customFps))
      : Number(config.fpsPreset);
  const durationSec = Math.max(2, Math.min(20, plan.totalDurationSec));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: config.format === 'GIF' });
  if (!ctx) {
    throw new Error('Browser 2D Canvas context could not be initialized for export.');
  }

  const frameDrawer = createExportFrameDrawer(ctx, plan, width, height, config);

  if (config.format === 'GIF') {
    try {
      return await exportAsGif(
        canvas,
        frameDrawer.drawFrame,
        width,
        height,
        Math.min(fps, 15),
        durationSec,
        config,
        onProgress,
        abortSignal
      );
    } finally {
      frameDrawer.dispose();
    }
  }

  // Video Export via MediaRecorder + canvas.captureStream
  const desiredMp4 = config.format === 'MP4';
  const mp4Supported =
    typeof MediaRecorder !== 'undefined' &&
    MediaRecorder.isTypeSupported('video/mp4');
  const webmVp9Supported =
    typeof MediaRecorder !== 'undefined' &&
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9');
  const webmSupported =
    typeof MediaRecorder !== 'undefined' &&
    MediaRecorder.isTypeSupported('video/webm');

  if (typeof MediaRecorder === 'undefined' || (!mp4Supported && !webmVp9Supported && !webmSupported)) {
    frameDrawer.dispose();
    throw new Error(
      'Your current browser does not support MediaRecorder video encoding. Try exporting as GIF instead.'
    );
  }

  let mimeType = 'video/webm';
  let actualExtension: 'webm' | 'mp4' = 'webm';
  let note: string | undefined;

  if (desiredMp4 && mp4Supported) {
    mimeType = 'video/mp4';
    actualExtension = 'mp4';
  } else {
    mimeType = webmVp9Supported ? 'video/webm;codecs=vp9' : 'video/webm';
    actualExtension = 'webm';
    if (desiredMp4) {
      note =
        'Your browser encoded this video as WebM (VP9/VP8) because native browser MP4 MediaRecorder encoding is not available in this browser.';
    }
  }

  const videoBitsPerSecond =
    config.quality === 'Maximum'
      ? 12_000_000
      : config.quality === 'High'
      ? 5_500_000
      : 2_200_000;

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<ExportResult>((resolve, reject) => {
    const totalFrames = Math.ceil(durationSec * fps);
    const frameIntervalMs = 1000 / fps;
    let frameIndex = 0;

    const cleanup = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      frameDrawer.dispose();
    };

    recorder.onerror = () => {
      cleanup();
      reject(new Error('Video recording encountered an encoding error.'));
    };

    recorder.onstop = () => {
      cleanup();
      if (abortSignal?.aborted) {
        reject(new Error('Export cancelled.'));
        return;
      }
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) {
        reject(new Error('Rendered video buffer was empty.'));
        return;
      }
      onProgress(100, 'Finalizing video container...');
      resolve({ blob, mimeType, actualExtension, note });
    };

    recorder.start(250);

    const step = () => {
      if (abortSignal?.aborted) {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }

      const tSec = frameIndex / fps;
      frameDrawer.drawFrame(tSec);

      const pct = Math.min(97, Math.round((frameIndex / totalFrames) * 97));
      onProgress(pct, `Rendering frame ${frameIndex + 1} of ${totalFrames} (${width}×${height})...`);

      frameIndex++;
      if (frameIndex >= totalFrames) {
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 120);
      } else {
        setTimeout(step, frameIntervalMs);
      }
    };

    step();
  });
}

// Pure-TypeScript LZW GIF89a Encoder for real animated GIF exports
async function exportAsGif(
  canvas: HTMLCanvasElement,
  drawFrame: FrameDrawer,
  width: number,
  height: number,
  fps: number,
  durationSec: number,
  config: ExportConfig,
  onProgress: (percent: number, stageLabel: string) => void,
  abortSignal?: AbortSignal
): Promise<ExportResult> {
  // Cap GIF dimensions cleanly if gigantic so browser memory stays responsive
  const scaleFactor = Math.min(1, 640 / Math.max(width, height));
  const gifW = Math.max(64, Math.round(width * scaleFactor));
  const gifH = Math.max(64, Math.round(height * scaleFactor));

  const gifCanvas = document.createElement('canvas');
  gifCanvas.width = gifW;
  gifCanvas.height = gifH;
  const gCtx = gifCanvas.getContext('2d', { willReadFrequently: true })!;

  const totalFrames = Math.max(6, Math.ceil(durationSec * fps));
  const delayCs = Math.max(2, Math.round(100 / fps)); // centiseconds

  const bytes: number[] = [];
  const pushStr = (s: string) => {
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  };
  const push16 = (v: number) => {
    bytes.push(v & 0xff, (v >> 8) & 0xff);
  };

  // GIF89a Header
  pushStr('GIF89a');
  push16(gifW);
  push16(gifH);
  // Global Color Table Flag=1, Color Res=7, Sort=0, Size=7 (256 colors) -> 0xF7
  bytes.push(0xf7, 0, 0);

  // Build 256-color RGB332 palette (index 255 reserved for transparency if needed)
  for (let i = 0; i < 256; i++) {
    const r = Math.round(((i >> 5) & 0x07) * (255 / 7));
    const g = Math.round(((i >> 2) & 0x07) * (255 / 7));
    const b = Math.round((i & 0x03) * (255 / 3));
    bytes.push(r, g, b);
  }

  // Netscape 2.0 infinite loop extension
  bytes.push(0x21, 0xff, 0x0b);
  pushStr('NETSCAPE2.0');
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);

  const transparent = config.background === 'Transparent';

  for (let f = 0; f < totalFrames; f++) {
    if (abortSignal?.aborted) {
      throw new Error('GIF export cancelled.');
    }

    const tSec = f / fps;
    drawFrame(tSec);

    gCtx.clearRect(0, 0, gifW, gifH);
    gCtx.drawImage(canvas, 0, 0, gifW, gifH);
    const imgData = gCtx.getImageData(0, 0, gifW, gifH).data;

    // Map RGBA to 8-bit palette indices
    const pixels = new Uint8Array(gifW * gifH);
    for (let p = 0; p < gifW * gifH; p++) {
      const idx = p * 4;
      const a = imgData[idx + 3];
      if (transparent && a < 64) {
        pixels[p] = 255;
      } else {
        const r = imgData[idx] >> 5;
        const g = imgData[idx + 1] >> 5;
        const b = imgData[idx + 2] >> 6;
        let pal = (r << 5) | (g << 2) | b;
        if (transparent && pal === 255) pal = 254;
        pixels[p] = pal;
      }
    }

    // Graphic Control Extension
    bytes.push(0x21, 0xf9, 0x04);
    bytes.push(transparent ? 0x09 : 0x04); // dispose=2 if transparent
    push16(delayCs);
    bytes.push(transparent ? 255 : 0, 0);

    // Image Descriptor
    bytes.push(0x2c);
    push16(0);
    push16(0);
    push16(gifW);
    push16(gifH);
    bytes.push(0x00);

    // LZW Encode (minCodeSize = 8)
    const encoded = lzwEncodeGif(pixels, 8);
    bytes.push(8);
    for (let i = 0; i < encoded.length; i += 255) {
      const subLen = Math.min(255, encoded.length - i);
      bytes.push(subLen);
      for (let j = 0; j < subLen; j++) {
        bytes.push(encoded[i + j]);
      }
    }
    bytes.push(0x00);

    const pct = Math.min(96, Math.round(((f + 1) / totalFrames) * 96));
    onProgress(pct, `Encoding GIF frame ${f + 1} of ${totalFrames}...`);

    // Yield to UI thread
    await new Promise((r) => setTimeout(r, 0));
  }

  bytes.push(0x3b); // GIF Trailer
  onProgress(100, 'GIF ready for download.');

  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'image/gif' }),
    mimeType: 'image/gif',
    actualExtension: 'gif',
    note:
      scaleFactor < 1
        ? `GIF frames were scaled proportionally to ${gifW}×${gifH} for optimal browser memory performance.`
        : undefined,
  };
}

function lzwEncodeGif(pixels: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;

  const out: number[] = [];
  let curByte = 0;
  let curBits = 0;

  const writeBits = (code: number, size: number) => {
    curByte |= code << curBits;
    curBits += size;
    while (curBits >= 8) {
      out.push(curByte & 0xff);
      curByte >>= 8;
      curBits -= 8;
    }
  };

  let dict = new Map<string, number>();
  const resetDict = () => {
    dict = new Map<string, number>();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  writeBits(clearCode, codeSize);

  let prefix = String(pixels[0]);
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i];
    const key = `${prefix},${k}`;
    if (dict.has(key)) {
      prefix = key;
    } else {
      const prefixCode = prefix.includes(',') ? dict.get(prefix)! : Number(prefix);
      writeBits(prefixCode, codeSize);

      if (nextCode < 4096) {
        dict.set(key, nextCode++);
        if (nextCode > 1 << codeSize && codeSize < 12) {
          codeSize++;
        }
      } else {
        writeBits(clearCode, codeSize);
        resetDict();
      }
      prefix = String(k);
    }
  }

  const lastCode = prefix.includes(',') ? dict.get(prefix)! : Number(prefix);
  writeBits(lastCode, codeSize);
  writeBits(eoiCode, codeSize);
  if (curBits > 0) {
    out.push(curByte & 0xff);
  }

  return out;
}
