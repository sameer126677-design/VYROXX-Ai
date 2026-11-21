import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  RefreshCw,
  Play,
  Pause,
  Maximize2,
  FileText,
  Music,
  Film,
  Image as ImageIcon,
  Orbit,
  FileJson,
} from 'lucide-react';
import {
  AnimationScenePlan,
  is3DScenePlan,
  resolveSceneVisualStyle,
} from '../shared/sceneSchema';
import { AssetRecord } from '../types';
import { renderScenePlanFrame } from '../engine/safeRenderer';
import { ThreeSceneRuntime } from '../engine/three/ThreeSceneRuntime';
import {
  fetchAuthenticatedAssetArrayBuffer,
  fetchAuthenticatedAssetBlobUrl,
} from '../lib/apiClient';
import { downloadScenePlanJson } from '../lib/downloadPlan';

interface AnimationPreviewPlayerProps {
  scenePlan: AnimationScenePlan;
  autoPlay?: boolean;
  onDownload: () => void;
  onRegenerate: () => void;
  isRegenerating?: boolean;
}

// Serial queue using a single shared offscreen WebGLRenderer for 3D thumbnails
// so My Projects grids never exceed browser active WebGL context limits.
let sharedThumbCanvas: HTMLCanvasElement | null = null;
let sharedThumbRuntime: ThreeSceneRuntime | null = null;
let thumbQueuePromise: Promise<void> = Promise.resolve();

function queue3DThumbnailRender(
  targetCanvas: HTMLCanvasElement,
  plan: AnimationScenePlan,
  tSec: number
): Promise<void> {
  const runTask = () => {
    try {
      if (!sharedThumbCanvas) {
        sharedThumbCanvas = document.createElement('canvas');
        sharedThumbCanvas.width = targetCanvas.width;
        sharedThumbCanvas.height = targetCanvas.height;
      }
      if (!sharedThumbRuntime) {
        sharedThumbRuntime = new ThreeSceneRuntime(
          plan,
          targetCanvas.width,
          targetCanvas.height,
          { fetchProtectedAssetBytes: fetchAuthenticatedAssetArrayBuffer }
        );
        sharedThumbRuntime.attachRenderer(sharedThumbCanvas, {
          preserveDrawingBuffer: true,
          alpha: false,
        });
      } else {
        sharedThumbRuntime.resize(targetCanvas.width, targetCanvas.height);
        sharedThumbRuntime.updatePlan(plan);
      }
      sharedThumbRuntime.seekTime(tSec);
      sharedThumbRuntime.renderFrame();

      const ctx = targetCanvas.getContext('2d');
      if (ctx && sharedThumbCanvas) {
        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        ctx.drawImage(
          sharedThumbCanvas,
          0,
          0,
          targetCanvas.width,
          targetCanvas.height
        );
      }
    } catch {
      // Fallback safely if WebGL is unavailable in environment
      const ctx = targetCanvas.getContext('2d');
      if (ctx) {
        renderScenePlanFrame(ctx, plan, targetCanvas.width, targetCanvas.height, tSec);
      }
    }
  };

  thumbQueuePromise = thumbQueuePromise.then(
    () => new Promise<void>((resolve) => {
      runTask();
      resolve();
    })
  );
  return thumbQueuePromise;
}

export const AnimationPreviewPlayer: React.FC<AnimationPreviewPlayerProps> = ({
  scenePlan,
  autoPlay = true,
  onDownload,
  onRegenerate,
  isRegenerating = false,
}) => {
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);
  const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
  const runtime3dRef = useRef<ThreeSceneRuntime | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [freeOrbit, setFreeOrbit] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const timeRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const isRegenRef = useRef(isRegenerating);

  isPlayingRef.current = isPlaying;
  isRegenRef.current = isRegenerating;

  const is3D = is3DScenePlan(scenePlan);
  const scenes = Array.isArray(scenePlan?.scenes) ? scenePlan.scenes : [];
  const totalDuration = Math.max(
    1,
    scenes.reduce((acc, s) => acc + (s?.durationSec || 0), 0)
  );

  const safeWidth = Math.max(128, scenePlan?.width || 1280);
  const safeHeight = Math.max(128, scenePlan?.height || 720);
  const aspectRatio = safeWidth / safeHeight;
  const internalWidth = Math.min(1280, Math.max(480, safeWidth));
  const internalHeight = Math.round(internalWidth / aspectRatio);

  useEffect(() => {
    setIsPlaying(autoPlay);
  }, [autoPlay]);

  // Toggle interactive OrbitControls cleanly on 3D runtime
  useEffect(() => {
    if (runtime3dRef.current) {
      runtime3dRef.current.setInteractiveOrbit(freeOrbit);
    }
  }, [freeOrbit]);

  // 2D Canvas Animation Loop
  useEffect(() => {
    if (is3D) return;
    const canvas = canvas2dRef.current;
    if (!canvas || scenes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    let lastTs = performance.now();

    const drawLoop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      if (isPlayingRef.current && !isRegenRef.current) {
        timeRef.current = (timeRef.current + dt) % totalDuration;
        setCurrentTimeSec(timeRef.current);
        setProgressPct((timeRef.current / totalDuration) * 100);
      }

      renderScenePlanFrame(
        ctx,
        scenePlan,
        canvas.width,
        canvas.height,
        timeRef.current
      );

      rafId = requestAnimationFrame(drawLoop);
    };

    rafId = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(rafId);
  }, [is3D, scenePlan, scenes.length, totalDuration]);

  // True 3D Three.js WebGL Animation Loop
  useEffect(() => {
    if (!is3D) return;
    const canvas = canvas3dRef.current;
    if (!canvas || scenes.length === 0) return;

    const runtime = new ThreeSceneRuntime(
      scenePlan,
      internalWidth,
      internalHeight,
      { fetchProtectedAssetBytes: fetchAuthenticatedAssetArrayBuffer }
    );
    runtime.attachRenderer(canvas, {
      preserveDrawingBuffer: false,
      alpha: true,
      enableOrbitControls: true,
    });
    runtime.setInteractiveOrbit(freeOrbit);
    runtime3dRef.current = runtime;

    let rafId = 0;
    let disposed = false;
    let lastTs = performance.now();
    let frameCount = 0;

    const draw3DLoop = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.08, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      if (isPlayingRef.current && !isRegenRef.current) {
        timeRef.current = (timeRef.current + dt) % totalDuration;
        frameCount++;
        if (frameCount % 3 === 0) {
          setCurrentTimeSec(timeRef.current);
          setProgressPct((timeRef.current / totalDuration) * 100);
        }
      }

      runtime.seekTime(timeRef.current, dt);
      runtime.renderFrame();

      if (runtime.isSoftwareGl) {
        setTimeout(() => {
          if (!disposed) rafId = requestAnimationFrame(draw3DLoop);
        }, 16);
      } else {
        rafId = requestAnimationFrame(draw3DLoop);
      }
    };

    rafId = requestAnimationFrame(draw3DLoop);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      runtime3dRef.current = null;
      runtime.dispose();
    };
  }, [is3D, scenePlan, scenes.length, totalDuration, internalWidth, internalHeight]);

  const handleFullScreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resolvedStyle = resolveSceneVisualStyle(scenePlan);
  const artStyleLabel =
    scenePlan?.visualContinuity?.artStyle ||
    (is3D ? `3D · ${resolvedStyle}` : `2D · ${resolvedStyle}`);

  return (
    <div
      ref={containerRef}
      className="relative group rounded-2xl p-2 bg-slate-900/75 border border-cyan-300/25 shadow-[0_20px_50px_rgba(0,0,0,0.65)] overflow-hidden max-w-3xl"
    >
      <div
        className="relative rounded-xl overflow-hidden bg-[#050814] mx-auto max-h-[460px] flex items-center justify-center"
        style={{
          aspectRatio: `${safeWidth} / ${safeHeight}`,
          backgroundImage: scenes.some(
            (s) => s.background?.mode === 'transparent'
          )
            ? 'linear-gradient(45deg, #0f172a 25%, transparent 25%), linear-gradient(-45deg, #0f172a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0f172a 75%), linear-gradient(-45deg, transparent 75%, #0f172a 75%)'
            : undefined,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
        }}
      >
        {is3D ? (
          <canvas
            ref={canvas3dRef}
            width={internalWidth}
            height={internalHeight}
            onClick={() => {
              if (!freeOrbit) setIsPlaying((p) => !p);
            }}
            className={`w-full h-full object-contain ${
              freeOrbit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            }`}
          />
        ) : (
          <canvas
            ref={canvas2dRef}
            width={internalWidth}
            height={internalHeight}
            onClick={() => setIsPlaying((p) => !p)}
            className="w-full h-full object-contain cursor-pointer"
          />
        )}

        {/* Scene Metadata Strip (no backdrop-filter over WebGL canvas) */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 text-xs text-slate-200/95 bg-slate-950/88 px-3 py-1.5 rounded-lg border border-white/10 pointer-events-none">
          <span className="font-semibold text-cyan-300">
            {is3D ? '3D WebGL' : '2D Vector'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-medium">
            {scenes.length} Scene{scenes.length > 1 ? 's' : ''}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">
            {safeWidth}×{safeHeight}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{scenePlan?.fps || 30} FPS</span>
          <span aria-hidden="true">·</span>
          <span>{artStyleLabel}</span>
        </div>

        {/* Regenerating overlay */}
        {isRegenerating && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 z-20">
            <div className="w-11 h-11 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-cyan-200 tracking-wide">
              Re-planning scene...
            </p>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

        {/* Left Playback Controls */}
        <div className="absolute bottom-3.5 left-3.5 flex items-center gap-2.5 z-10">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="w-9 h-9 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/15 flex items-center justify-center text-white transition-colors cursor-pointer"
            title={isPlaying ? 'Pause Preview' : 'Play Preview'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {is3D && (
            <button
              type="button"
              onClick={() => setFreeOrbit((v) => !v)}
              className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                freeOrbit
                  ? 'bg-cyan-500/25 border-cyan-400/70 text-cyan-200'
                  : 'bg-slate-900/85 hover:bg-slate-800 border-white/10 text-slate-300 hover:text-white'
              }`}
              title="Toggle Interactive 3D Orbit Camera"
            >
              <Orbit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{freeOrbit ? 'Auto Cam' : 'Orbit 3D'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFullScreen}
            className="w-8 h-8 rounded-lg bg-slate-900/85 hover:bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Fullscreen Preview"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-mono-tabular text-slate-300/90 hidden sm:inline-block ml-1">
            {formatSec(currentTimeSec)} / {formatSec(totalDuration)}
          </span>
        </div>

        {/* Right Primary Actions: Download & Regenerate */}
        <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2.5 z-10">
          <button
            type="button"
            onClick={() =>
              downloadScenePlanJson(scenePlan, (scenePlan as { title?: string }).title)
            }
            aria-label="Download scene plan (JSON)"
            title="Download scene plan (JSON)"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-100 text-xs sm:text-sm font-medium border border-cyan-300/30 shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all hover:border-cyan-400/60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileJson className="w-4 h-4 text-cyan-300" />
            <span>Plan</span>
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-100 text-xs sm:text-sm font-medium border border-cyan-300/30 shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all hover:border-cyan-400/60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-300" />
            <span>Download</span>
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-100 text-xs sm:text-sm font-medium border border-cyan-300/30 shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all hover:border-cyan-400/60 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-300 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-900/90">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-100"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export const ProjectThumbnailCanvas: React.FC<{
  scenePlan: AnimationScenePlan | null;
  className?: string;
}> = ({ scenePlan, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scenePlan) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const firstDur = scenePlan.scenes?.[0]?.durationSec || 5;
    const thumbTime = Math.min(Math.max(1.25, firstDur * 0.72), 6);

    if (is3DScenePlan(scenePlan)) {
      queue3DThumbnailRender(canvas, scenePlan, thumbTime).catch(() => {});
    } else {
      renderScenePlanFrame(ctx, scenePlan, canvas.width, canvas.height, thumbTime);
    }
  }, [scenePlan]);

  if (!scenePlan) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950/60 text-slate-400 text-xs ${className}`}
      >
        <Film className="w-7 h-7 text-cyan-400/50 mb-1.5" />
        <span>Awaiting scene render</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={270}
      className={`w-full h-full object-cover ${className}`}
    />
  );
};

export const AuthenticatedAssetThumbnail: React.FC<{
  asset: AssetRecord;
  className?: string;
}> = ({ asset, className = '' }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if ((isImage || isVideo) && asset.storagePath) {
      fetchAuthenticatedAssetBlobUrl(asset.storagePath)
        .then((url) => {
          createdUrl = url;
          if (active) setBlobUrl(url);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [asset.storagePath, isImage, isVideo]);

  if (isImage && blobUrl) {
    return (
      <img
        src={blobUrl}
        alt={asset.name}
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  if (isVideo && blobUrl) {
    return (
      <div className={`relative w-full h-full bg-slate-950 ${className}`}>
        <video
          src={blobUrl}
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-slate-900/85 border border-cyan-300/60 flex items-center justify-center">
            <Play className="w-4 h-4 text-white ml-0.5 fill-white" />
          </div>
        </div>
      </div>
    );
  }

  if (asset.mimeType.startsWith('audio/')) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950/70 via-slate-950 to-cyan-950/60 text-cyan-300 ${className}`}
      >
        <Music className="w-9 h-9 mb-1.5 opacity-85" />
        <span className="text-[11px] font-mono-tabular text-slate-300">
          {asset.fileFormat} Audio
        </span>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-slate-300 ${className}`}
    >
      {isImage || isVideo ? (
        failed ? (
          <ImageIcon className="w-8 h-8 text-slate-500 mb-1" />
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        )
      ) : (
        <FileText className="w-9 h-9 text-sky-400/80 mb-1.5" />
      )}
      <span className="text-[11px] font-mono-tabular text-slate-400">
        {asset.fileFormat}
      </span>
    </div>
  );
};
