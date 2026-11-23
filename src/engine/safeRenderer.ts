import {
  AnimationScenePlan,
  CharacterSpec,
  ChartSpec,
  DroneSpec,
  hydrateCharacterSpec,
  LogoSpec,
  PlanetSpec,
  resolveSceneVisualStyle,
  RoadSpec,
  SceneElement,
  SceneSegment,
  TextSpec,
  VehicleSpec,
  VisualContinuityBible,
  VisualStyle,
} from '../shared/sceneSchema';
import { evaluatePhysicsState } from './three/physics';

export interface RenderOptions {
  transparentCanvas?: boolean;
  overrideBackground?: 'Original' | 'Transparent';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function withAlpha(hex: string, alpha: number): string {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#38bdf8';
  const a = Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${clean}${a}`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

function resolveActiveScene(
  plan: AnimationScenePlan,
  timeSec: number
): {
  current: SceneSegment;
  next: SceneSegment | null;
  localTime: number;
  transitionProgress: number;
} {
  const total = Math.max(
    1,
    plan.scenes.reduce((acc, s) => acc + s.durationSec, 0)
  );
  const looped = ((timeSec % total) + total) % total;

  let elapsed = 0;
  for (let i = 0; i < plan.scenes.length; i++) {
    const seg = plan.scenes[i];
    if (looped < elapsed + seg.durationSec || i === plan.scenes.length - 1) {
      const localTime = looped - elapsed;
      const transWindow = Math.min(0.65, seg.durationSec * 0.25);
      const remaining = seg.durationSec - localTime;
      const next = plan.scenes[(i + 1) % plan.scenes.length];
      const transitionProgress =
        plan.scenes.length > 1 && seg.transition !== 'cut' && remaining < transWindow
          ? clamp(1 - remaining / transWindow, 0, 1)
          : 0;
      return {
        current: seg,
        next: transitionProgress > 0 ? next : null,
        localTime,
        transitionProgress,
      };
    }
    elapsed += seg.durationSec;
  }

  return {
    current: plan.scenes[0],
    next: null,
    localTime: looped,
    transitionProgress: 0,
  };
}

let pixelBufferCanvas: HTMLCanvasElement | null = null;

export function renderScenePlanFrame(
  ctx: CanvasRenderingContext2D,
  plan: AnimationScenePlan,
  width: number,
  height: number,
  timeSec: number,
  options: RenderOptions = {}
): void {
  ctx.clearRect(0, 0, width, height);
  if (!plan || !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    return;
  }

  const { current, next, localTime, transitionProgress } = resolveActiveScene(
    plan,
    timeSec
  );

  const visualStyle = resolveSceneVisualStyle(plan, current);

  // Pixel-Retro nearest-neighbor quantized rasterizer when DOM canvas is available
  if (
    visualStyle === 'pixel-retro' &&
    typeof document !== 'undefined' &&
    width >= 160 &&
    height >= 90
  ) {
    const pixelW = Math.max(120, Math.round(width / 4));
    const pixelH = Math.max(68, Math.round(height / 4));
    if (!pixelBufferCanvas) {
      pixelBufferCanvas = document.createElement('canvas');
    }
    pixelBufferCanvas.width = pixelW;
    pixelBufferCanvas.height = pixelH;
    const pCtx = pixelBufferCanvas.getContext('2d');
    if (pCtx) {
      pCtx.clearRect(0, 0, pixelW, pixelH);
      renderSingleScene(
        pCtx,
        current,
        plan.visualContinuity,
        visualStyle,
        pixelW,
        pixelH,
        localTime,
        options
      );
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pixelBufferCanvas, 0, 0, width, height);
      // Subtle crisp CRT scanlines
      ctx.fillStyle = 'rgba(2, 6, 23, 0.14)';
      for (let sy = 0; sy < height; sy += 4) {
        ctx.fillRect(0, sy, width, 1);
      }
      ctx.restore();
      return;
    }
  }

  renderSingleScene(
    ctx,
    current,
    plan.visualContinuity,
    visualStyle,
    width,
    height,
    localTime,
    options
  );

  if (next && transitionProgress > 0) {
    const nextStyle = resolveSceneVisualStyle(plan, next);
    ctx.save();
    if (current.transition === 'fade') {
      ctx.globalAlpha = transitionProgress;
      renderSingleScene(
        ctx,
        next,
        plan.visualContinuity,
        nextStyle,
        width,
        height,
        0,
        options
      );
    } else if (current.transition === 'pan-wipe') {
      const wipeX = width * (1 - transitionProgress);
      ctx.beginPath();
      ctx.rect(wipeX, 0, width - wipeX, height);
      ctx.clip();
      renderSingleScene(
        ctx,
        next,
        plan.visualContinuity,
        nextStyle,
        width,
        height,
        0,
        options
      );
    }
    ctx.restore();
  }
}

function renderSingleScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneSegment,
  continuity: VisualContinuityBible | undefined,
  visualStyle: VisualStyle,
  w: number,
  h: number,
  t: number,
  options: RenderOptions
): void {
  ctx.save();

  const useTransparent =
    options.overrideBackground === 'Transparent' ||
    scene.background.mode === 'transparent';

  // 1. Background Layer
  if (!useTransparent) {
    if (scene.background.mode === 'solid') {
      ctx.fillStyle = scene.background.solidColor;
      ctx.fillRect(0, 0, w, h);

      // Subtle studio radial sheen matching lighting bloom
      const studioGlow = ctx.createRadialGradient(
        w * 0.5,
        h * 0.45,
        w * 0.05,
        w * 0.5,
        h * 0.5,
        w * 0.65
      );
      studioGlow.addColorStop(0, withAlpha(scene.lighting.bloomColor, 0.14));
      studioGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = studioGlow;
      ctx.fillRect(0, 0, w, h);
    } else {
      const groundY = h * scene.background.groundElevation;
      const drawGround = scene.background.groundElevation < 0.96;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, drawGround ? groundY : h);
      skyGrad.addColorStop(0, scene.background.skyTop);
      skyGrad.addColorStop(0.75, scene.background.skyBottom);
      skyGrad.addColorStop(1, scene.background.horizonColor);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, drawGround ? groundY + 4 : h);

      // Ambient horizon glow
      if (drawGround) {
        const hGlow = ctx.createRadialGradient(
          w * 0.5,
          groundY,
          w * 0.02,
          w * 0.5,
          groundY,
          w * 0.55
        );
        hGlow.addColorStop(0, withAlpha(scene.lighting.bloomColor, 0.28));
        hGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hGlow;
        ctx.fillRect(0, 0, w, groundY + 4);

        const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
        groundGrad.addColorStop(0, scene.background.groundColor);
        groundGrad.addColorStop(1, '#030712');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, w, h - groundY);
      }
    }
  }

  // 2. Camera Motion Transform
  const intensity = scene.camera.intensity;
  const normT = clamp(t / Math.max(1, scene.durationSec), 0, 1);
  ctx.save();
  switch (scene.camera.motion) {
    case 'zoom-in': {
      const s = 1 + normT * 0.18 * intensity;
      ctx.translate(w / 2, h / 2);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
      break;
    }
    case 'zoom-out': {
      const s = 1 + (1 - normT) * 0.18 * intensity;
      ctx.translate(w / 2, h / 2);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
      break;
    }
    case 'pan-left': {
      ctx.translate(-normT * w * 0.1 * intensity, 0);
      break;
    }
    case 'pan-right': {
      ctx.translate((normT - 0.5) * w * 0.1 * intensity, 0);
      break;
    }
    case 'follow-subject': {
      ctx.translate(Math.sin(t * 1.4) * w * 0.03 * intensity, 0);
      break;
    }
    case 'handheld-shake': {
      ctx.translate(
        Math.sin(t * 14) * 5 * intensity,
        Math.cos(t * 17) * 3.5 * intensity
      );
      break;
    }
    default:
      break;
  }

  // 2.5 Abstract-Generative Harmonic Field Layer
  if (visualStyle === 'abstract-generative') {
    drawGenerativeField2D(ctx, scene, w, h, t);
  }

  // 3. Sort and draw validated elements by depth
  const sorted = [...scene.elements].sort((a, b) => a.depth - b.depth);
  for (const el of sorted) {
    drawElement(ctx, el, scene, continuity, visualStyle, w, h, t, normT);
  }

  ctx.restore(); // end camera transform

  // 4. Weather Effects
  drawWeather(ctx, scene, w, h, t);

  // 4.5 Cartoon/Anime Speed-Lines Accent for high-energy 2D styles
  if (visualStyle === 'cartoon-2d' || visualStyle === 'anime-cel') {
    drawCartoonSpeedLines(ctx, scene, w, h, t);
  }

  // 5. Lighting Mood, Volumetric Rays & Vignette
  if (!useTransparent) {
    drawLightingOverlay(ctx, scene, w, h);
  }

  ctx.restore();
}

function computeAnimatedPosition(
  el: SceneElement,
  w: number,
  h: number,
  t: number
): { px: number; py: number; pulseScale: number } {
  let xNorm = el.x;
  let yNorm = el.y;
  let pulseScale = 1;

  // Special orbital placement for planets with explicit orbital parameters
  if (el.kind === 'planet' && el.planetSpec && el.planetSpec.bodyRole !== 'star' && el.planetSpec.orbitRadiusX > 0) {
    const p = el.planetSpec;
    const speed = el.motion.speed === 0 ? 0.5 : el.motion.speed;
    const angle = p.orbitStartAngle + t * speed * 0.45 * el.motion.direction;
    xNorm = p.orbitCenterX + Math.cos(angle) * p.orbitRadiusX;
    yNorm = p.orbitCenterY + Math.sin(angle) * p.orbitRadiusY;
    return {
      px: xNorm * w,
      py: yNorm * h,
      pulseScale: 1,
    };
  }

  const { type, speed, amplitude, direction } = el.motion;

  switch (type) {
    case 'move-horizontal': {
      // Road/skyline scroll inside their drawers; characters/vehicles/drones glide cleanly
      if (el.kind === 'vehicle' || el.kind === 'drone' || el.kind === 'character' || el.kind === 'creature') {
        const span = 1.24;
        const offset = ((t * speed * 0.13 * direction) % span + span) % span;
        xNorm = ((xNorm + offset) % span) - 0.12;
      } else {
        xNorm += Math.sin(t * speed * 0.8) * amplitude * 0.5 * direction;
      }
      break;
    }
    case 'move-vertical': {
      yNorm += Math.sin(t * speed * 1.8) * amplitude * 0.5 * direction;
      break;
    }
    case 'bob': {
      yNorm += Math.sin(t * (2.5 + Math.abs(speed))) * Math.max(0.015, amplitude * 0.35);
      break;
    }
    case 'orbit': {
      const rx = Math.max(0.06, amplitude * 0.75);
      const ry = rx * 0.55;
      xNorm += Math.cos(t * speed * 1.3 * direction) * rx;
      yNorm += Math.sin(t * speed * 1.3 * direction) * ry;
      break;
    }
    case 'chase': {
      const stride = Math.sin(t * (4 + Math.abs(speed) * 2)) * 0.022 * direction;
      xNorm += ((t * speed * 0.075 * direction) % 0.45) + stride;
      if (xNorm > 1.15) xNorm -= 1.25;
      if (xNorm < -0.15) xNorm += 1.25;
      yNorm += Math.abs(Math.sin(t * (6 + Math.abs(speed) * 2))) * -0.012;
      break;
    }
    case 'pulse': {
      pulseScale = 1 + Math.sin(t * (2 + Math.abs(speed))) * Math.min(0.25, amplitude * 0.65);
      break;
    }
    case 'pan-parallax': {
      xNorm += Math.sin(t * 0.35 * speed * direction) * amplitude * (0.15 + el.depth * 0.4);
      break;
    }
    default:
      break;
  }

  return {
    px: xNorm * w,
    py: yNorm * h,
    pulseScale,
  };
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  scene: SceneSegment,
  continuity: VisualContinuityBible | undefined,
  visualStyle: VisualStyle,
  w: number,
  h: number,
  t: number,
  normT: number
): void {
  const unit = Math.min(w, h) * 0.12 * el.scale;
  const groundY = h * scene.background.groundElevation;
  let { px, py, pulseScale } = computeAnimatedPosition(el, w, h, t);
  let squashX = 1;
  let squashY = 1;

  // Deterministic 2D physics displacement & squash-and-stretch
  if (el.physicsSpec && el.physicsSpec.mode !== 'none') {
    const metersToPx = h * 0.08;
    const baseHeightMeters = Math.max(0, (groundY - py) / metersToPx);
    const phys = evaluatePhysicsState(
      el.physicsSpec,
      { x: 0, y: baseHeightMeters, z: 0 },
      t
    );
    px += phys.x * metersToPx;
    py = groundY - phys.y * metersToPx;
    squashX = phys.scaleX;
    squashY = phys.scaleY;
  }

  ctx.save();
  if (el.opacity !== undefined) {
    ctx.globalAlpha = clamp(el.opacity, 0.05, 1);
  }
  if (squashX !== 1 || squashY !== 1) {
    ctx.translate(px, py);
    ctx.scale(squashX, squashY);
    ctx.translate(-px, -py);
  }
  if (el.rotationDeg) {
    ctx.translate(px, py);
    ctx.rotate((el.rotationDeg * Math.PI) / 180);
    ctx.translate(-px, -py);
  }

  switch (el.kind) {
    case 'chart': {
      drawChartElement(ctx, el, px, py, w, h, t, normT);
      break;
    }

    case 'text': {
      drawTextElement(ctx, el, px, py, w, h, t, normT);
      break;
    }

    case 'logo': {
      drawLogoElement(ctx, el, px, py, w, h, t, normT);
      break;
    }

    case 'planet': {
      drawPlanetElement(ctx, el, px, py, w, h, t, unit);
      break;
    }

    case 'drone': {
      drawDroneElement(ctx, el, px, py, unit, t, pulseScale);
      break;
    }

    case 'road': {
      drawRoadElement(ctx, el, scene, groundY, w, h, t);
      break;
    }

    case 'particle-burst': {
      drawParticleBurst(ctx, el, px, py, unit, t);
      break;
    }

    case 'sun-moon': {
      const r = unit * 0.9 * pulseScale;
      const grad = ctx.createRadialGradient(px, py, r * 0.1, px, py, r * 2.1);
      grad.addColorStop(0, el.accentColor);
      grad.addColorStop(0.5, el.colorPrimary);
      grad.addColorStop(1, withAlpha(el.colorPrimary, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r * 2.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = el.colorPrimary;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'clouds': {
      ctx.fillStyle = withAlpha(el.colorPrimary, 0.65);
      for (let i = 0; i < el.count; i++) {
        const cx = ((px + i * (w / el.count) + t * 18 * el.motion.speed) % (w + 180)) - 90;
        const cy = py + Math.sin(i * 1.7) * unit * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, unit * 0.5, 0, Math.PI * 2);
        ctx.arc(cx + unit * 0.45, cy - unit * 0.15, unit * 0.6, 0, Math.PI * 2);
        ctx.arc(cx + unit * 0.95, cy, unit * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'mountains': {
      for (let i = 0; i < el.count; i++) {
        const mx = (i / Math.max(1, el.count - 1)) * w * 1.1 - w * 0.05 + (px - w * 0.5) * 0.15;
        const mw = (w / el.count) * 1.45;
        const mh = unit * (1.8 + (i % 3) * 0.7);
        ctx.fillStyle = i % 2 === 0 ? el.colorPrimary : el.colorSecondary;
        ctx.beginPath();
        ctx.moveTo(mx - mw * 0.5, groundY + 4);
        ctx.lineTo(mx, groundY - mh);
        ctx.lineTo(mx + mw * 0.5, groundY + 4);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 'skyline': {
      const spanW = w * 1.1;
      const bw = spanW / Math.max(4, el.count);
      for (let i = 0; i < el.count; i++) {
        const bx = i * bw - w * 0.05 + (px - w * 0.5) * 0.12;
        const bh = unit * (1.7 + ((i * 7) % 5) * 0.55);
        const by = groundY - bh;

        ctx.fillStyle = i % 2 === 0 ? el.colorPrimary : el.colorSecondary;
        ctx.fillRect(bx + 2, by, bw - 5, bh + 4);

        if (el.variant === 'ruined') {
          ctx.fillStyle = scene.background.skyBottom;
          ctx.beginPath();
          ctx.moveTo(bx + 2, by);
          ctx.lineTo(bx + bw * 0.35, by + bh * 0.18);
          ctx.lineTo(bx + bw * 0.55, by + bh * 0.07);
          ctx.lineTo(bx + bw * 0.8, by + bh * 0.22);
          ctx.lineTo(bx + bw - 3, by);
          ctx.closePath();
          ctx.fill();

          // Dark blown-out windows & rebar spikes
          ctx.strokeStyle = el.accentColor;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.35, by + bh * 0.18);
          ctx.lineTo(bx + bw * 0.37, by + bh * 0.04);
          ctx.stroke();

          ctx.fillStyle = '#02061799';
          for (let wy = by + bh * 0.28; wy < groundY - 14; wy += 18) {
            for (let wx = bx + 10; wx < bx + bw - 14; wx += 14) {
              if ((wx + wy + i) % 4 === 0) {
                ctx.fillRect(wx, wy, 7, 10);
              }
            }
          }
        } else if (
          el.variant === 'futuristic' ||
          el.variant === 'glowing' ||
          el.variant === 'cyberpunk' ||
          el.variant === 'neon'
        ) {
          ctx.strokeStyle = withAlpha(el.accentColor, 0.75);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx + 3, by + 2, bw - 7, bh);
          ctx.fillStyle = withAlpha(el.accentColor, 0.55);
          for (let wy = by + 12; wy < groundY - 12; wy += 16) {
            for (let wx = bx + 8; wx < bx + bw - 12; wx += 12) {
              if ((wx + wy + i) % 3 !== 0) {
                ctx.fillRect(wx, wy, 5, 8);
              }
            }
          }
          // Rooftop neon sign strip
          if (i % 2 === 0) {
            ctx.fillStyle = el.accentColor;
            ctx.fillRect(bx + 8, by + 8, Math.max(12, bw * 0.45), 4);
          }
        } else if (el.variant === 'medieval') {
          ctx.fillStyle = el.accentColor;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + bw * 0.5, by - unit * 0.55);
          ctx.lineTo(bx + bw - 3, by);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }

    case 'trees': {
      for (let i = 0; i < el.count; i++) {
        const tx = ((px + i * (w / el.count)) % (w + 80)) - 40;
        const ty = groundY;
        const th = unit * (1.2 + (i % 3) * 0.3);
        ctx.fillStyle = el.colorSecondary;
        ctx.fillRect(tx - unit * 0.08, ty - th * 0.45, unit * 0.16, th * 0.48);

        ctx.fillStyle = el.colorPrimary;
        if (el.variant === 'ruined') {
          ctx.strokeStyle = el.colorPrimary;
          ctx.lineWidth = Math.max(2, unit * 0.07);
          ctx.beginPath();
          ctx.moveTo(tx, ty - th * 0.4);
          ctx.lineTo(tx - unit * 0.35, ty - th * 0.85);
          ctx.moveTo(tx, ty - th * 0.4);
          ctx.lineTo(tx + unit * 0.32, ty - th * 0.78);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(tx, ty - th * 0.65, unit * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case 'grid-floor': {
      ctx.strokeStyle = withAlpha(el.accentColor, 0.5);
      ctx.lineWidth = 1.4;
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + i * (w * 0.03), groundY);
        ctx.lineTo(w * 0.5 + i * (w * 0.18), h);
        ctx.stroke();
      }
      for (let r = 1; r <= 6; r++) {
        const gy = groundY + ((r * r) / 36) * (h - groundY);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
      break;
    }

    case 'character':
    case 'creature': {
      const matchBible = continuity?.characterBible.find(
        (b) =>
          el.label.toLowerCase().includes(b.name.toLowerCase()) ||
          b.name.toLowerCase().includes(el.label.toLowerCase())
      );
      const spec: CharacterSpec = el.characterSpec
        ? el.characterSpec
        : hydrateCharacterSpec(undefined, el, matchBible || null);
      drawDetailedCharacter(ctx, el, spec, px, py, w, h, t, pulseScale);
      break;
    }

    case 'vehicle': {
      const vSpec: VehicleSpec = el.vehicleSpec || {
        subKind: 'sports-car',
        speedLines: true,
        headlights: true,
        exhaustFlame: true,
        wheelSpin: true,
        numberTag: '',
      };
      drawDetailedVehicle(ctx, el, vSpec, px, py, w, unit, t);
      break;
    }

    case 'energy-ring': {
      const r = unit * 0.9 * pulseScale;
      ctx.strokeStyle = el.accentColor;
      ctx.lineWidth = Math.max(2, unit * 0.08);
      ctx.shadowColor = el.accentColor;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = el.colorPrimary;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(px, py, r * 1.28, t * 0.8, t * 0.8 + Math.PI * 1.7);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      break;
    }

    case 'light-beam': {
      const grad = ctx.createLinearGradient(
        px,
        py,
        px + el.motion.direction * unit * 3.4,
        py + unit * 0.5
      );
      grad.addColorStop(0, withAlpha(el.accentColor, 0.55));
      grad.addColorStop(1, withAlpha(el.accentColor, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + el.motion.direction * unit * 3.4, py - unit * 0.75);
      ctx.lineTo(px + el.motion.direction * unit * 3.4, py + unit * 0.85);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'procedural-mesh': {
      drawProceduralShape2D(ctx, el, visualStyle, px, py, unit, t);
      break;
    }

    case 'shader-fx': {
      drawShaderFx2D(ctx, el, px, py, unit, t);
      break;
    }

    case 'prop':
    default: {
      drawContextualProp(ctx, el, px, py, unit, t);
      break;
    }
  }

  ctx.restore();
}

function drawGenerativeField2D(
  ctx: CanvasRenderingContext2D,
  scene: SceneSegment,
  w: number,
  h: number,
  t: number
): void {
  ctx.save();
  const ribbons = 5;
  for (let r = 0; r < ribbons; r++) {
    ctx.strokeStyle = withAlpha(scene.lighting.bloomColor, 0.22 + r * 0.06);
    ctx.lineWidth = 2 + r * 0.6;
    ctx.beginPath();
    for (let x = 0; x <= w; x += Math.max(8, w / 48)) {
      const nx = x / w;
      const y =
        h * 0.5 +
        Math.sin(nx * Math.PI * 3 + t * (1.2 + r * 0.3) + r) * h * 0.16 +
        Math.cos(nx * Math.PI * 5 - t * 0.9 + r * 1.4) * h * 0.08;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCartoonSpeedLines(
  ctx: CanvasRenderingContext2D,
  scene: SceneSegment,
  w: number,
  h: number,
  t: number
): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(scene.lighting.bloomColor || '#f8fafc', 0.22);
  ctx.lineWidth = 2;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const rays = 18;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + Math.sin(t * 2 + i) * 0.05;
    const inner = Math.min(w, h) * (0.36 + 0.04 * Math.sin(t * 10 + i));
    const outer = Math.max(w, h) * 0.72;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProceduralShape2D(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  visualStyle: VisualStyle,
  px: number,
  py: number,
  unit: number,
  t: number
): void {
  const r = unit * 0.52;
  const isCartoon = visualStyle === 'cartoon-2d';
  const geom = el.proceduralGeometry ?? 'sphere';

  ctx.save();
  ctx.fillStyle = el.colorPrimary;
  ctx.strokeStyle = isCartoon ? '#090d16' : el.accentColor;
  ctx.lineWidth = isCartoon ? 3.8 : 2;

  if (geom === 'box') {
    roundedRect(ctx, px - r, py - r * 2, r * 2, r * 2, isCartoon ? 10 : 4);
    ctx.fill();
    ctx.stroke();
  } else if (geom === 'cone') {
    ctx.beginPath();
    ctx.moveTo(px, py - r * 2);
    ctx.lineTo(px + r, py);
    ctx.lineTo(px - r, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Grounded sphere / ball at py
    const cy = py - r;
    const grad = ctx.createRadialGradient(px - r * 0.3, cy - r * 0.3, r * 0.1, px, cy, r);
    grad.addColorStop(0, el.accentColor);
    grad.addColorStop(0.55, el.colorPrimary);
    grad.addColorStop(1, el.colorSecondary);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isCartoon) {
      // Crisp cel specular crescent
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(px - r * 0.32, cy - r * 0.32, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Subtle rotating accent ring for torus/knot
  if (geom === 'torus' || geom === 'torus-knot') {
    ctx.strokeStyle = el.accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(px, py - r, r * 1.15, r * 0.4, t * 1.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShaderFx2D(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  px: number,
  py: number,
  unit: number,
  t: number
): void {
  const r = unit * 0.9;
  const rings = 5;
  ctx.save();
  for (let i = 0; i < rings; i++) {
    const phase = ((t * 0.8 + i / rings) % 1);
    ctx.strokeStyle = withAlpha(i % 2 === 0 ? el.colorPrimary : el.accentColor, 1 - phase);
    ctx.lineWidth = 3 * (1 - phase * 0.5);
    ctx.beginPath();
    ctx.arc(px, py - r * 0.5, r * (0.3 + phase * 1.2), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function formatMetricValue(val: number, prefix: string, suffix: string): string {
  const abs = Math.abs(val);
  let numStr: string;
  if (abs >= 1000) {
    numStr = val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  } else if (Number.isInteger(val)) {
    numStr = String(val);
  } else {
    numStr = val.toFixed(1);
  }
  return `${prefix}${numStr}${suffix}`;
}

function drawChartElement(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  px: number,
  py: number,
  w: number,
  h: number,
  t: number,
  normT: number
): void {
  const spec: ChartSpec = el.chartSpec || {
    chartType: 'line',
    title: el.label,
    xAxisLabel: 'Period',
    yAxisLabel: 'Value',
    valuePrefix: '',
    valueSuffix: '',
    smoothCurve: true,
    easing: 'accelerate',
    showGrid: true,
    showAreaFill: true,
    showMovingMarker: true,
    highlightFinalBadge: '',
    points: [
      { label: 'Q1', value: 10 },
      { label: 'Q2', value: 25 },
      { label: 'Q3', value: 55 },
      { label: 'Q4', value: 100 },
    ],
  };

  const cardW = clamp(w * 0.7 * el.scale, w * 0.38, w * 0.9);
  const cardH = clamp(h * 0.58 * el.scale, h * 0.34, h * 0.82);
  const left = clamp(px - cardW / 2, w * 0.05, w - cardW - w * 0.05);
  const top = clamp(py - cardH / 2, h * 0.08, h - cardH - h * 0.06);

  // Card Backdrop
  ctx.fillStyle = withAlpha(el.colorSecondary, 0.84);
  ctx.strokeStyle = withAlpha(el.accentColor, 0.32);
  ctx.lineWidth = 1.5;
  roundedRect(ctx, left, top, cardW, cardH, 16);
  ctx.fill();
  ctx.stroke();

  // Header Title
  const padL = clamp(cardW * 0.13, 56, 92);
  const padR = clamp(cardW * 0.06, 26, 48);
  const padT = clamp(cardH * 0.16, 44, 68);
  const padB = clamp(cardH * 0.16, 42, 62);
  const plotX = left + padL;
  const plotY = top + padT;
  const plotW = Math.max(60, cardW - padL - padR);
  const plotH = Math.max(50, cardH - padT - padB);

  const titleSize = Math.round(clamp(cardH * 0.055, 13, 22));
  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.title, left + 22, top + padT * 0.48);

  if (spec.yAxisLabel) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 ${Math.max(10, titleSize - 4)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(spec.yAxisLabel, left + cardW - 22, top + padT * 0.48);
  }

  // Value range
  const values = spec.points.map((p) => p.value);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(...values);
  const maxVal = rawMax <= rawMin ? rawMin + 10 : rawMax * 1.12;
  const minVal = rawMin;
  const span = maxVal - minVal;

  const yTicks = 4;
  const axisFont = Math.round(clamp(cardH * 0.036, 10, 14));
  ctx.font = `500 ${axisFont}px ui-monospace, SFMono-Regular, monospace`;

  for (let i = 0; i <= yTicks; i++) {
    const frac = i / yTicks;
    const yy = plotY + plotH - frac * plotH;
    const tickVal = minVal + frac * span;

    if (spec.showGrid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash(i === 0 ? [] : [4, 5]);
      ctx.beginPath();
      ctx.moveTo(plotX, yy);
      ctx.lineTo(plotX + plotW, yy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      formatMetricValue(tickVal, spec.valuePrefix, spec.valueSuffix),
      plotX - 10,
      yy
    );
  }

  // Main Axes Lines
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(plotX, plotY);
  ctx.lineTo(plotX, plotY + plotH);
  ctx.lineTo(plotX + plotW, plotY + plotH);
  ctx.stroke();

  // Compute chart points coordinates
  const n = spec.points.length;
  const coords = spec.points.map((pt, idx) => {
    const x = plotX + (n === 1 ? plotW * 0.5 : (idx / (n - 1)) * plotW);
    const y = plotY + plotH - ((pt.value - minVal) / span) * plotH;
    return { x, y, label: pt.label, value: pt.value };
  });

  // X-axis tick labels
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `500 ${axisFont}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelStep = n > 10 ? 2 : 1;
  for (let i = 0; i < n; i += labelStep) {
    ctx.fillText(coords[i].label, coords[i].x, plotY + plotH + 8);
  }
  if (spec.xAxisLabel) {
    ctx.fillStyle = '#64748b';
    ctx.font = `600 ${Math.max(10, axisFont - 1)}px Inter, system-ui, sans-serif`;
    ctx.fillText(spec.xAxisLabel, plotX + plotW * 0.5, plotY + plotH + 25);
  }

  // Animation draw progress (0 -> 1 over first 76% of scene, then holds with pulse)
  const rawU = clamp(normT / 0.76, 0, 1);
  const easedU =
    spec.easing === 'accelerate'
      ? Math.pow(rawU, 1.9)
      : spec.easing === 'ease-out'
      ? 1 - Math.pow(1 - rawU, 2.4)
      : rawU;

  if (spec.chartType === 'bar') {
    const slotW = plotW / n;
    const barW = Math.min(44, slotW * 0.58);
    for (let i = 0; i < n; i++) {
      const barStart = (i / n) * 0.65;
      const barLocal = clamp((easedU - barStart) / 0.35, 0, 1);
      const fullH = plotY + plotH - coords[i].y;
      const curH = fullH * barLocal;
      const bx = coords[i].x - barW / 2;
      const by = plotY + plotH - curH;

      const bGrad = ctx.createLinearGradient(0, by, 0, plotY + plotH);
      bGrad.addColorStop(0, el.colorPrimary);
      bGrad.addColorStop(1, withAlpha(el.colorPrimary, 0.25));
      ctx.fillStyle = bGrad;
      roundedRect(ctx, bx, by, barW, curH, 6);
      ctx.fill();

      if (barLocal > 0.75) {
        ctx.fillStyle = el.accentColor;
        ctx.font = `600 ${Math.max(10, axisFont - 1)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          formatMetricValue(coords[i].value, spec.valuePrefix, spec.valueSuffix),
          coords[i].x,
          by - 5
        );
      }
    }
  } else {
    // Line / Area chart with smooth Catmull-Rom or crisp linear curve clipped to current progress
    const clipW = plotW * easedU;
    const traceCurvePath = () => {
      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);
      if (spec.smoothCurve && coords.length >= 3) {
        for (let i = 0; i < coords.length - 1; i++) {
          const p0 = coords[Math.max(0, i - 1)];
          const p1 = coords[i];
          const p2 = coords[i + 1];
          const p3 = coords[Math.min(coords.length - 1, i + 2)];
          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x - (p3.x - p1.x) / 6;
          const cp2y = p2.y - (p3.y - p1.y) / 6;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
      } else {
        for (let i = 1; i < coords.length; i++) {
          ctx.lineTo(coords[i].x, coords[i].y);
        }
      }
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(plotX - 6, plotY - 24, clipW + 10, plotH + 34);
    ctx.clip();

    if (spec.showAreaFill || spec.chartType === 'area') {
      traceCurvePath();
      ctx.lineTo(coords[coords.length - 1].x, plotY + plotH);
      ctx.lineTo(coords[0].x, plotY + plotH);
      ctx.closePath();
      const areaGrad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
      areaGrad.addColorStop(0, withAlpha(el.colorPrimary, 0.42));
      areaGrad.addColorStop(1, withAlpha(el.colorPrimary, 0.02));
      ctx.fillStyle = areaGrad;
      ctx.fill();
    }

    // Outer glow stroke + crisp inner core
    traceCurvePath();
    ctx.strokeStyle = el.colorPrimary;
    ctx.lineWidth = 4;
    ctx.shadowColor = el.colorPrimary;
    ctx.shadowBlur = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = el.accentColor;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // Sample live tip point (tipX, tipY) along curve segments
    const fIdx = easedU * (coords.length - 1);
    const i0 = Math.min(coords.length - 2, Math.floor(fIdx));
    const segFrac = fIdx - i0;
    const c0 = coords[i0];
    const c1 = coords[i0 + 1];
    let tipX = c0.x + (c1.x - c0.x) * segFrac;
    let tipY = c0.y + (c1.y - c0.y) * segFrac;
    if (spec.smoothCurve && coords.length >= 3) {
      const p0 = coords[Math.max(0, i0 - 1)];
      const p3 = coords[Math.min(coords.length - 1, i0 + 2)];
      const cp1y = c0.y + (c1.y - p0.y) / 6;
      const cp2y = c1.y - (p3.y - c0.y) / 6;
      const u = segFrac;
      const inv = 1 - u;
      tipY =
        inv * inv * inv * c0.y +
        3 * inv * inv * u * cp1y +
        3 * inv * u * u * cp2y +
        u * u * u * c1.y;
    }
    const tipVal = c0.value + (c1.value - c0.value) * segFrac;

    // Draw data dots for passed points
    for (let i = 0; i < coords.length; i++) {
      if (coords[i].x <= tipX + 2) {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = el.colorPrimary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(coords[i].x, coords[i].y, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Moving Marker & Live Value Readout
    if (spec.showMovingMarker) {
      const pulse = 1 + 0.25 * Math.sin(t * 6);
      ctx.fillStyle = withAlpha(el.colorPrimary, 0.28);
      ctx.beginPath();
      ctx.arc(tipX, tipY, 12 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = el.accentColor;
      ctx.strokeStyle = el.colorPrimary;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (easedU < 0.94 || !spec.highlightFinalBadge) {
        const liveStr = formatMetricValue(tipVal, spec.valuePrefix, spec.valueSuffix);
        ctx.font = `700 ${axisFont}px ui-monospace, monospace`;
        const tw = ctx.measureText(liveStr).width + 16;
        const tagX = clamp(tipX - tw / 2, plotX, plotX + plotW - tw);
        const tagY = Math.max(plotY - 26, tipY - 32);
        ctx.fillStyle = '#020617ee';
        ctx.strokeStyle = el.colorPrimary;
        ctx.lineWidth = 1.2;
        roundedRect(ctx, tagX, tagY, tw, 22, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(liveStr, tagX + tw / 2, tagY + 11);
      }
    }
  }

  // Final Milestone Highlight Callout Badge (e.g. "$10 Million")
  if (spec.highlightFinalBadge && easedU >= 0.88) {
    const badgePop = clamp((easedU - 0.88) / 0.12, 0, 1);
    const lastPt = coords[coords.length - 1];
    ctx.save();
    ctx.globalAlpha *= badgePop;
    ctx.font = `700 ${Math.max(12, axisFont + 2)}px Inter, system-ui, sans-serif`;
    const bw = ctx.measureText(spec.highlightFinalBadge).width + 24;
    const bh = 28;
    const bx = clamp(lastPt.x - bw * 0.85, plotX + 4, left + cardW - bw - 10);
    const by = Math.max(top + 10, lastPt.y - 40);

    ctx.fillStyle = el.colorPrimary;
    ctx.shadowColor = el.colorPrimary;
    ctx.shadowBlur = 18;
    roundedRect(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#020617';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.highlightFinalBadge, bx + bw / 2, by + bh / 2 + 0.5);
    ctx.restore();
  }
}

function drawDetailedCharacter(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  spec: CharacterSpec,
  px: number,
  py: number,
  w: number,
  h: number,
  t: number,
  pulseScale: number
): void {
  const isCreature =
    el.kind === 'creature' ||
    spec.archetype === 'zombie' ||
    spec.archetype === 'beast';
  const detailMult =
    spec.detailLevel === 'hero' ? 1.32 : spec.detailLevel === 'high' ? 1.15 : 1;
  const charH = Math.min(w, h) * 0.25 * el.scale * detailMult * pulseScale;

  const isRunning =
    spec.pose === 'running' ||
    spec.pose === 'sprinting' ||
    spec.pose === 'chasing' ||
    el.variant === 'running' ||
    el.variant === 'chasing';
  const isWalking = spec.pose === 'walking' || el.variant === 'walking';
  const isFloating = spec.pose === 'floating';
  const isKneeling = spec.pose === 'kneeling';
  const dir = el.motion.direction >= 0 ? 1 : -1;
  const strideFreq =
    spec.pose === 'sprinting'
      ? 12
      : isRunning
      ? 9.2
      : isWalking
      ? 5.2
      : 1.8;

  for (let i = 0; i < el.count; i++) {
    const cx = px - i * charH * 0.48 * dir;
    const cy = py + (i % 2) * charH * 0.04;
    const phase = t * strideFreq + i * 1.15;

    const swingAmp = isRunning ? 0.68 : isWalking ? 0.42 : 0.05;
    const legA = isKneeling ? 0.55 : isFloating ? 0.15 : Math.sin(phase) * swingAmp;
    const legB = isKneeling ? -0.35 : isFloating ? -0.1 : Math.sin(phase + Math.PI) * swingAmp;
    const armA = isKneeling
      ? 0.48
      : isRunning
      ? Math.sin(phase + Math.PI) * 0.72
      : isWalking
      ? Math.sin(phase + Math.PI) * 0.4
      : isCreature
      ? -1.05 + Math.sin(phase) * 0.12
      : spec.pose === 'aiming'
      ? -1.25
      : 0.12;
    const armB = isKneeling
      ? 0.28
      : isRunning
      ? Math.sin(phase) * 0.72
      : isWalking
      ? Math.sin(phase) * 0.4
      : isCreature
      ? -0.9 + Math.cos(phase) * 0.12
      : -0.18;

    const bounce = isKneeling
      ? Math.sin(t * 1.8 + i) * charH * 0.006
      : isRunning
      ? Math.abs(Math.sin(phase)) * -charH * 0.045
      : isWalking
      ? Math.abs(Math.sin(phase)) * -charH * 0.02
      : Math.sin(phase) * charH * 0.015;
    const lean = isKneeling
      ? 0.08 * dir
      : isRunning
      ? 0.2 * dir
      : isCreature
      ? 0.26 * dir
      : isWalking
      ? 0.07 * dir
      : 0;

    // Kneeling lowers the pelvis and shoulders while keeping the head readable.
    const hipY = isKneeling ? -charH * 0.28 : -charH * 0.38;
    const shoulderY = isKneeling ? -charH * 0.62 : -charH * 0.72;
    const headY = isKneeling ? -charH * 0.77 : -charH * 0.86;
    const headR = charH * 0.115;
    const torsoW = charH * (spec.armorStyle === 'heavy-plate' ? 0.26 : 0.21);
    const thighLen = charH * 0.21;
    const shinLen = charH * 0.2;
    const upperArmLen = charH * 0.16;
    const foreArmLen = charH * 0.15;

    ctx.save();
    ctx.translate(cx, cy);

    // Contact shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, charH * 0.05, charH * 0.22, charH * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bounce);
    ctx.scale(dir, 1);
    ctx.rotate(lean * dir);

    const drawLeg = (angle: number, isBack: boolean) => {
      const kneeBend = isKneeling
        ? (isBack ? 1.35 : 1.1)
        : Math.max(0, -Math.cos(phase + (isBack ? Math.PI : 0)) * (isRunning ? 0.65 : 0.35));
      const kx = Math.sin(angle) * thighLen;
      const ky = hipY + Math.cos(angle) * thighLen;
      const fx = kx + Math.sin(angle - kneeBend) * shinLen;
      const fy = ky + Math.cos(angle - kneeBend) * shinLen;

      ctx.strokeStyle = isBack
        ? withAlpha(spec.secondaryGearColor, 0.78)
        : spec.secondaryGearColor;
      ctx.lineWidth = Math.max(4, charH * 0.075);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy);
      ctx.stroke();

      // Knee pad armor
      if (spec.armorStyle === 'tactical' || spec.armorStyle === 'heavy-plate' || spec.armorStyle === 'cyber-suit') {
        ctx.fillStyle = spec.armorColor;
        ctx.beginPath();
        ctx.arc(kx, ky, charH * 0.036, 0, Math.PI * 2);
        ctx.fill();
      }

      // Boot
      ctx.fillStyle = isCreature ? spec.secondaryGearColor : '#0f172a';
      ctx.strokeStyle = spec.armorColor;
      ctx.lineWidth = 1.4;
      roundedRect(ctx, fx - charH * 0.035, fy - charH * 0.02, charH * 0.105, charH * 0.05, 4);
      ctx.fill();
      if (!isCreature) ctx.stroke();
    };

    // Flowing Cloak / Trench Coat behind torso
    if (spec.cloakOrCoat || spec.armorStyle === 'trench-coat') {
      const billow =
        (isRunning ? -charH * 0.22 : -charH * 0.09) +
        Math.sin(t * 6 + i) * charH * 0.05;
      ctx.fillStyle = spec.cloakColor;
      ctx.beginPath();
      ctx.moveTo(-torsoW * 0.3, shoulderY + charH * 0.02);
      ctx.quadraticCurveTo(
        billow * 0.9,
        hipY - charH * 0.06,
        billow - charH * 0.16,
        hipY + charH * 0.24
      );
      ctx.lineTo(-torsoW * 0.05, hipY + charH * 0.2);
      ctx.lineTo(torsoW * 0.25, hipY + charH * 0.05);
      ctx.closePath();
      ctx.fill();
    }

    // Back Arm & Back Leg
    const drawArm = (angle: number, isBack: boolean, withWeapon: boolean) => {
      const elbowBend = isRunning ? -0.65 : spec.pose === 'aiming' ? -0.35 : -0.25;
      const ex = Math.sin(angle) * upperArmLen;
      const ey = shoulderY + charH * 0.04 + Math.cos(angle) * upperArmLen;
      const hx = ex + Math.sin(angle + elbowBend) * foreArmLen;
      const hy = ey + Math.cos(angle + elbowBend) * foreArmLen;

      ctx.strokeStyle = isBack
        ? withAlpha(spec.armorColor, 0.72)
        : spec.armorColor;
      ctx.lineWidth = Math.max(3.5, charH * 0.062);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, shoulderY + charH * 0.04);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // Gauntlet
      ctx.fillStyle = spec.secondaryGearColor;
      ctx.beginPath();
      ctx.arc(hx, hy, charH * 0.032, 0, Math.PI * 2);
      ctx.fill();

      // Held Weapon / Gear
      if (withWeapon && spec.weaponOrGear !== 'none') {
        ctx.save();
        ctx.translate(hx, hy);
        if (spec.weaponOrGear === 'rifle') {
          ctx.rotate(spec.pose === 'aiming' ? 0 : -0.18);
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = spec.visorColor;
          ctx.lineWidth = 1.4;
          roundedRect(ctx, -charH * 0.06, -charH * 0.025, charH * 0.28, charH * 0.045, 2);
          ctx.fill();
          ctx.fillStyle = spec.visorColor;
          ctx.fillRect(charH * 0.08, -charH * 0.036, charH * 0.07, charH * 0.012);
        } else if (spec.weaponOrGear === 'blade') {
          ctx.rotate(-0.5);
          ctx.fillStyle = spec.visorColor;
          ctx.shadowColor = spec.visorColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(0, -charH * 0.014);
          ctx.lineTo(charH * 0.28, -charH * 0.028);
          ctx.lineTo(charH * 0.31, 0);
          ctx.lineTo(0, charH * 0.014);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (spec.weaponOrGear === 'umbrella') {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(charH * 0.04, -charH * 0.36);
          ctx.stroke();
          ctx.fillStyle = spec.armorColor;
          ctx.beginPath();
          ctx.arc(charH * 0.04, -charH * 0.34, charH * 0.22, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
        } else if (spec.weaponOrGear === 'scanner') {
          ctx.fillStyle = '#0f172a';
          roundedRect(ctx, 0, -charH * 0.03, charH * 0.09, charH * 0.055, 3);
          ctx.fill();
          ctx.fillStyle = withAlpha(spec.visorColor, 0.45);
          ctx.beginPath();
          ctx.moveTo(charH * 0.08, -charH * 0.01);
          ctx.lineTo(charH * 0.24, -charH * 0.11);
          ctx.lineTo(charH * 0.24, charH * 0.07);
          ctx.closePath();
          ctx.fill();
        } else if (spec.weaponOrGear === 'shield') {
          ctx.fillStyle = spec.armorColor;
          ctx.strokeStyle = spec.visorColor;
          ctx.lineWidth = 2;
          roundedRect(ctx, charH * 0.02, -charH * 0.12, charH * 0.07, charH * 0.24, 6);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    drawArm(armB, true, false);
    drawLeg(legB, true);

    // Backpack / Gear Pack
    if (spec.weaponOrGear === 'backpack' || spec.archetype === 'ranger' || spec.archetype === 'astronaut') {
      ctx.fillStyle = spec.secondaryGearColor;
      ctx.strokeStyle = spec.armorColor;
      ctx.lineWidth = 1.4;
      roundedRect(
        ctx,
        -torsoW * 0.85,
        shoulderY + charH * 0.02,
        torsoW * 0.55,
        charH * 0.24,
        5
      );
      ctx.fill();
      ctx.stroke();
    }

    // Torso & Layered Armor
    ctx.fillStyle = spec.armorColor;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.55, shoulderY);
    ctx.lineTo(torsoW * 0.55, shoulderY);
    ctx.lineTo(torsoW * 0.4, hipY + charH * 0.02);
    ctx.lineTo(-torsoW * 0.4, hipY + charH * 0.02);
    ctx.closePath();
    ctx.fill();

    // Chestplate / Cyber Trim / Tactical Harness
    if (!isCreature && spec.armorStyle !== 'none') {
      ctx.fillStyle = spec.secondaryGearColor;
      roundedRect(
        ctx,
        -torsoW * 0.42,
        shoulderY + charH * 0.03,
        torsoW * 0.86,
        charH * 0.16,
        4
      );
      ctx.fill();

      // Glowing chest core / trim line
      ctx.fillStyle = spec.visorColor;
      ctx.shadowColor = spec.visorColor;
      ctx.shadowBlur = 8;
      ctx.fillRect(torsoW * 0.1, shoulderY + charH * 0.07, torsoW * 0.24, charH * 0.035);
      ctx.shadowBlur = 0;

      // Utility belt
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-torsoW * 0.43, hipY - charH * 0.04, torsoW * 0.86, charH * 0.055);
      ctx.fillStyle = el.accentColor;
      ctx.fillRect(torsoW * 0.05, hipY - charH * 0.035, charH * 0.04, charH * 0.04);

      // Shoulder Pauldron
      if (spec.armorStyle === 'heavy-plate' || spec.armorStyle === 'tactical') {
        ctx.fillStyle = spec.armorColor;
        ctx.strokeStyle = el.accentColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, shoulderY + charH * 0.035, charH * 0.068, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Front Leg
    drawLeg(legA, false);

    // Head & Headgear
    ctx.save();
    ctx.translate(charH * 0.015, headY);
    if (isCreature) {
      // Hunched creature/zombie head
      ctx.fillStyle = el.colorPrimary;
      ctx.beginPath();
      ctx.arc(0, 0, headR * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // Jagged jaw
      ctx.fillStyle = el.colorSecondary;
      ctx.beginPath();
      ctx.moveTo(0, headR * 0.2);
      ctx.lineTo(headR * 0.85, headR * 0.4);
      ctx.lineTo(headR * 0.4, headR * 0.95);
      ctx.closePath();
      ctx.fill();

      // Eerie glowing eyes
      ctx.fillStyle = spec.visorColor;
      ctx.shadowColor = spec.visorColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(headR * 0.45, -headR * 0.1, headR * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (spec.headgear === 'visor-helmet' || spec.headgear === 'helmet') {
      // Sculpted tactical / ranger helmet
      ctx.fillStyle = spec.armorColor;
      ctx.strokeStyle = spec.secondaryGearColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, headR * 1.15, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(headR * 0.95, headR * 0.72);
      ctx.lineTo(-headR * 0.45, headR * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Helmet Crest
      ctx.fillStyle = spec.secondaryGearColor;
      roundedRect(ctx, -headR * 0.35, -headR * 1.24, headR * 0.95, headR * 0.26, 3);
      ctx.fill();

      // Bright Glowing Visor Slit
      ctx.fillStyle = spec.visorColor;
      ctx.shadowColor = spec.visorColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(headR * 0.12, -headR * 0.28);
      ctx.lineTo(headR * 1.06, -headR * 0.12);
      ctx.lineTo(headR * 0.96, headR * 0.24);
      ctx.lineTo(headR * 0.18, headR * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (spec.headgear === 'hood') {
      // Face + Hood Cowl
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, headR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = spec.armorColor;
      ctx.beginPath();
      ctx.arc(-headR * 0.12, 0, headR * 1.24, Math.PI * 0.55, Math.PI * 1.85);
      ctx.lineTo(headR * 0.9, -headR * 0.45);
      ctx.quadraticCurveTo(-headR * 0.2, 0, -headR * 0.1, headR * 1.1);
      ctx.closePath();
      ctx.fill();

      // Glowing eyes/visor under hood
      ctx.fillStyle = spec.visorColor;
      ctx.shadowColor = spec.visorColor;
      ctx.shadowBlur = 10;
      ctx.fillRect(headR * 0.28, -headR * 0.15, headR * 0.52, headR * 0.2);
      ctx.shadowBlur = 0;
    } else {
      // Stylized human head + hair + optional cyber optics
      ctx.fillStyle = '#e2cbb8';
      ctx.beginPath();
      ctx.arc(0, 0, headR, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = spec.hairColor;
      ctx.beginPath();
      ctx.arc(-headR * 0.08, -headR * 0.15, headR * 1.08, Math.PI * 0.85, Math.PI * 2.05);
      ctx.closePath();
      ctx.fill();

      if (spec.headgear === 'cyber-optics') {
        ctx.fillStyle = spec.visorColor;
        ctx.shadowColor = spec.visorColor;
        ctx.shadowBlur = 10;
        roundedRect(ctx, headR * 0.15, -headR * 0.25, headR * 0.88, headR * 0.3, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(headR * 0.48, -headR * 0.06, headR * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Front Arm (drawn over torso)
    drawArm(armA, false, true);

    ctx.restore();
  }
}

function drawDroneElement(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  px: number,
  py: number,
  unit: number,
  t: number,
  pulseScale: number
): void {
  const spec: DroneSpec = el.droneSpec || {
    rotorCount: 4,
    hasSearchlight: true,
    searchlightColor: el.accentColor,
    searchlightAngleDeg: 18,
    statusLedColor: '#ef4444',
  };

  for (let i = 0; i < el.count; i++) {
    const dx = px + i * unit * 1.6;
    const dy = py + Math.sin(t * 2.4 + i) * unit * 0.14;
    const bodyW = unit * 0.9 * pulseScale;
    const bodyH = unit * 0.28 * pulseScale;
    const bank = Math.sin(t * 1.6 + i) * 0.08 + el.motion.direction * 0.06;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(bank);

    // Sweeping Searchlight Cone
    if (spec.hasSearchlight) {
      const sweepRad =
        ((spec.searchlightAngleDeg + Math.sin(t * 1.8 + i) * 16) * Math.PI) / 180;
      ctx.save();
      ctx.translate(0, bodyH * 0.65);
      ctx.rotate(sweepRad);
      const beamLen = unit * 3.8;
      const beamW = unit * 1.45;
      const coneGrad = ctx.createLinearGradient(0, 0, 0, beamLen);
      coneGrad.addColorStop(0, withAlpha(spec.searchlightColor, 0.5));
      coneGrad.addColorStop(1, withAlpha(spec.searchlightColor, 0));
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(-unit * 0.08, 0);
      ctx.lineTo(beamW, beamLen);
      ctx.lineTo(-beamW, beamLen);
      ctx.lineTo(unit * 0.08, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Rotor Booms & Spinning Blades
    const armOffsets =
      spec.rotorCount >= 4
        ? [-bodyW * 0.92, -bodyW * 0.45, bodyW * 0.45, bodyW * 0.92]
        : [-bodyW * 0.8, bodyW * 0.8];

    ctx.strokeStyle = el.colorSecondary;
    ctx.lineWidth = Math.max(2, unit * 0.06);
    for (const ax of armOffsets) {
      ctx.beginPath();
      ctx.moveTo(ax * 0.35, -bodyH * 0.15);
      ctx.lineTo(ax, -bodyH * 0.72);
      ctx.stroke();

      // Rotor hub
      ctx.fillStyle = el.colorPrimary;
      ctx.fillRect(ax - unit * 0.04, -bodyH * 0.92, unit * 0.08, bodyH * 0.25);

      // Spinning Rotor Blur Disc
      const bladeSpan = unit * (0.34 + 0.1 * Math.abs(Math.sin(t * 28 + ax)));
      ctx.strokeStyle = withAlpha(el.accentColor, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ax, -bodyH * 0.92, bladeSpan, unit * 0.055, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Main Angular UAV Chassis
    ctx.fillStyle = el.colorPrimary;
    ctx.strokeStyle = el.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.55, 0);
    ctx.lineTo(-bodyW * 0.32, -bodyH * 0.6);
    ctx.lineTo(bodyW * 0.32, -bodyH * 0.6);
    ctx.lineTo(bodyW * 0.55, 0);
    ctx.lineTo(bodyW * 0.28, bodyH * 0.5);
    ctx.lineTo(-bodyW * 0.28, bodyH * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gimbal Camera Sensor Pod
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, bodyH * 0.55, unit * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Optical Eye
    ctx.fillStyle = spec.searchlightColor;
    ctx.shadowColor = spec.searchlightColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(el.motion.direction * unit * 0.06, bodyH * 0.58, unit * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Blinking Status LED
    const ledOn = Math.sin(t * 7 + i) > -0.2;
    if (ledOn) {
      ctx.fillStyle = spec.statusLedColor;
      ctx.shadowColor = spec.statusLedColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(-bodyW * 0.36, 0, unit * 0.045, 0, Math.PI * 2);
      ctx.arc(bodyW * 0.36, 0, unit * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

function drawDetailedVehicle(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  spec: VehicleSpec,
  px: number,
  py: number,
  w: number,
  unit: number,
  t: number
): void {
  const dir = el.motion.direction >= 0 ? 1 : -1;

  for (let i = 0; i < el.count; i++) {
    const vx =
      el.motion.type === 'move-horizontal'
        ? ((px + i * (w * 0.26) + t * 95 * el.motion.speed * dir) % (w + 240)) - 120
        : px + i * unit * 2.2;
    const bounce =
      spec.subKind === 'spaceship' || spec.subKind === 'ufo' || spec.subKind === 'helicopter'
        ? Math.sin(t * 2.6 + i) * unit * 0.14
        : Math.sin(t * 18 + i) * unit * 0.018;
    const vy = py + bounce;
    const vw = unit * 1.9;
    const vh = unit * 0.62;

    ctx.save();
    ctx.translate(vx, vy);
    ctx.scale(dir, 1);

    if (spec.speedLines) {
      ctx.strokeStyle = withAlpha(el.accentColor, 0.45);
      ctx.lineWidth = 1.6;
      for (let s = 0; s < 4; s++) {
        const sx = -vw * (0.75 + ((t * 4 + s * 0.4) % 1) * 0.7);
        const sy = -vh * 0.35 + s * vh * 0.24;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - vw * 0.45, sy);
        ctx.stroke();
      }
    }

    if (
      spec.subKind === 'racing-car' ||
      spec.subKind === 'sports-car' ||
      spec.subKind === 'cyber-car' ||
      spec.subKind === 'truck'
    ) {
      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, vh * 0.48, vw * 0.56, vh * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Exhaust nitro flame
      if (spec.exhaustFlame) {
        const flicker = 0.8 + 0.35 * Math.sin(t * 42);
        const flameGrad = ctx.createLinearGradient(-vw * 0.52, 0, -vw * (0.52 + 0.42 * flicker), 0);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, el.accentColor);
        flameGrad.addColorStop(1, withAlpha(el.accentColor, 0));
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-vw * 0.5, vh * 0.08);
        ctx.lineTo(-vw * (0.5 + 0.44 * flicker), vh * 0.15);
        ctx.lineTo(-vw * 0.5, vh * 0.24);
        ctx.closePath();
        ctx.fill();
      }

      // Headlight beam cone
      if (spec.headlights) {
        const hGrad = ctx.createLinearGradient(vw * 0.5, 0, vw * 1.55, 0);
        hGrad.addColorStop(0, withAlpha('#fef08a', 0.45));
        hGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = hGrad;
        ctx.beginPath();
        ctx.moveTo(vw * 0.52, vh * 0.02);
        ctx.lineTo(vw * 1.55, -vh * 0.32);
        ctx.lineTo(vw * 1.55, vh * 0.42);
        ctx.closePath();
        ctx.fill();
      }

      // Rear GT Wing Spoiler
      if (spec.subKind === 'racing-car' || spec.subKind === 'sports-car') {
        ctx.fillStyle = el.colorSecondary;
        ctx.fillRect(-vw * 0.47, -vh * 0.36, vw * 0.05, vh * 0.32);
        ctx.fillStyle = el.accentColor;
        ctx.beginPath();
        ctx.moveTo(-vw * 0.55, -vh * 0.42);
        ctx.lineTo(-vw * 0.36, -vh * 0.34);
        ctx.lineTo(-vw * 0.38, -vh * 0.28);
        ctx.lineTo(-vw * 0.56, -vh * 0.35);
        ctx.closePath();
        ctx.fill();
      }

      // Aerodynamic Chassis Silhouette
      ctx.fillStyle = el.colorPrimary;
      ctx.strokeStyle = el.accentColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (spec.subKind === 'truck') {
        ctx.moveTo(-vw * 0.52, vh * 0.26);
        ctx.lineTo(-vw * 0.52, -vh * 0.52);
        ctx.lineTo(vw * 0.22, -vh * 0.52);
        ctx.lineTo(vw * 0.28, -vh * 0.25);
        ctx.lineTo(vw * 0.48, -vh * 0.16);
        ctx.lineTo(vw * 0.54, vh * 0.26);
      } else {
        ctx.moveTo(-vw * 0.52, vh * 0.24);
        ctx.lineTo(-vw * 0.48, -vh * 0.16);
        ctx.lineTo(-vw * 0.24, -vh * 0.44);
        ctx.lineTo(vw * 0.1, -vh * 0.44);
        ctx.lineTo(vw * 0.34, -vh * 0.14);
        ctx.lineTo(vw * 0.54, vh * 0.05);
        ctx.lineTo(vw * 0.5, vh * 0.26);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tinted Cockpit Glass
      ctx.fillStyle = el.colorSecondary;
      ctx.beginPath();
      ctx.moveTo(-vw * 0.19, -vh * 0.16);
      ctx.lineTo(-vw * 0.12, -vh * 0.38);
      ctx.lineTo(vw * 0.09, -vh * 0.38);
      ctx.lineTo(vw * 0.25, -vh * 0.16);
      ctx.closePath();
      ctx.fill();

      // Racing Stripe & Number Tag
      ctx.fillStyle = el.accentColor;
      ctx.fillRect(-vw * 0.35, vh * 0.02, vw * 0.68, vh * 0.06);
      if (spec.numberTag) {
        ctx.fillStyle = '#f8fafc';
        ctx.font = `800 ${Math.round(vh * 0.28)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(spec.numberTag, -vw * 0.04, -vh * 0.04);
      }

      // Taillight & Headlight dots
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-vw * 0.51, -vh * 0.05, vw * 0.04, vh * 0.12);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(vw * 0.46, vh * 0.02, vw * 0.05, vh * 0.1);

      // Spinning Alloy Wheels
      const wheelPositions = [-vw * 0.31, vw * 0.32];
      const wheelR = vh * 0.27;
      for (const wx of wheelPositions) {
        const wy = vh * 0.26;
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(wx, wy, wheelR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy, wheelR * 0.62, 0, Math.PI * 2);
        ctx.stroke();

        // Rotating spokes
        const rot = spec.wheelSpin ? t * 18 : 0;
        ctx.strokeStyle = el.accentColor;
        ctx.lineWidth = 1.6;
        for (let k = 0; k < 4; k++) {
          const a = rot + (k * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + Math.cos(a) * wheelR * 0.58, wy + Math.sin(a) * wheelR * 0.58);
          ctx.stroke();
        }
      }
    } else if (spec.subKind === 'hover-bike') {
      // Sleek cyber hover bike
      ctx.fillStyle = el.colorPrimary;
      ctx.strokeStyle = el.accentColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-vw * 0.4, vh * 0.15);
      ctx.lineTo(-vw * 0.15, -vh * 0.28);
      ctx.lineTo(vw * 0.3, -vh * 0.22);
      ctx.lineTo(vw * 0.45, vh * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      for (const wx of [-vw * 0.32, vw * 0.32]) {
        ctx.strokeStyle = el.accentColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(wx, vh * 0.18, vh * 0.24, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (spec.subKind === 'helicopter') {
      // Helicopter cabin + tail + overhead rotor
      ctx.fillStyle = el.colorPrimary;
      ctx.beginPath();
      ctx.ellipse(0, 0, vw * 0.32, vh * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-vw * 0.62, -vh * 0.07, vw * 0.36, vh * 0.12);
      const bladeLen = vw * (0.48 + 0.12 * Math.sin(t * 32));
      ctx.strokeStyle = el.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-bladeLen, -vh * 0.42);
      ctx.lineTo(bladeLen, -vh * 0.42);
      ctx.stroke();
    } else if (spec.subKind === 'ufo') {
      ctx.fillStyle = el.colorPrimary;
      ctx.strokeStyle = el.accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, vw * 0.42, vh * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = el.colorSecondary;
      ctx.beginPath();
      ctx.ellipse(0, -vh * 0.18, vw * 0.2, vh * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Delta-wing Spaceship
      const flame = 0.75 + 0.35 * Math.sin(t * 30);
      const tGrad = ctx.createLinearGradient(-vw * 0.45, 0, -vw * (0.45 + 0.45 * flame), 0);
      tGrad.addColorStop(0, '#ffffff');
      tGrad.addColorStop(0.4, el.accentColor);
      tGrad.addColorStop(1, withAlpha(el.accentColor, 0));
      ctx.fillStyle = tGrad;
      ctx.beginPath();
      ctx.moveTo(-vw * 0.42, -vh * 0.12);
      ctx.lineTo(-vw * (0.42 + 0.45 * flame), 0);
      ctx.lineTo(-vw * 0.42, vh * 0.12);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = el.colorPrimary;
      ctx.strokeStyle = el.accentColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-vw * 0.45, -vh * 0.42);
      ctx.lineTo(vw * 0.52, 0);
      ctx.lineTo(-vw * 0.45, vh * 0.42);
      ctx.lineTo(-vw * 0.28, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = el.colorSecondary;
      ctx.beginPath();
      ctx.ellipse(vw * 0.08, 0, vw * 0.18, vh * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawPlanetElement(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  px: number,
  py: number,
  w: number,
  h: number,
  t: number,
  unit: number
): void {
  const spec: PlanetSpec = el.planetSpec || {
    bodyRole: 'planet',
    radiusScale: 1,
    hasRings: false,
    ringColor: el.accentColor,
    orbitCenterX: 0.5,
    orbitCenterY: 0.5,
    orbitRadiusX: 0,
    orbitRadiusY: 0,
    orbitStartAngle: 0,
    showOrbitPath: false,
    showLabel: true,
    surfaceStyle: 'rocky',
  };

  // Draw Orbital Track behind planet
  if (spec.showOrbitPath && spec.bodyRole !== 'star' && spec.orbitRadiusX > 0) {
    ctx.save();
    ctx.strokeStyle = withAlpha(el.accentColor, 0.25);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.ellipse(
      spec.orbitCenterX * w,
      spec.orbitCenterY * h,
      spec.orbitRadiusX * w,
      spec.orbitRadiusY * h,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  const r = unit * 0.42 * spec.radiusScale;

  if (spec.bodyRole === 'star' || spec.surfaceStyle === 'sun-corona') {
    const coronaR = r * (2.2 + 0.12 * Math.sin(t * 2.5));
    const cGrad = ctx.createRadialGradient(px, py, r * 0.2, px, py, coronaR);
    cGrad.addColorStop(0, '#ffffff');
    cGrad.addColorStop(0.28, el.accentColor);
    cGrad.addColorStop(0.6, withAlpha(el.colorPrimary, 0.55));
    cGrad.addColorStop(1, withAlpha(el.colorPrimary, 0));
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(px, py, coronaR, 0, Math.PI * 2);
    ctx.fill();

    // Solar flare core
    ctx.fillStyle = el.colorPrimary;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Back half of planetary rings
    if (spec.hasRings) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-0.28);
      ctx.strokeStyle = withAlpha(spec.ringColor, 0.65);
      ctx.lineWidth = Math.max(2, r * 0.22);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 2.05, r * 0.55, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Lit 3D planet sphere
    const grad = ctx.createRadialGradient(
      px - r * 0.35,
      py - r * 0.35,
      r * 0.12,
      px,
      py,
      r
    );
    grad.addColorStop(0, el.accentColor);
    grad.addColorStop(0.55, el.colorPrimary);
    grad.addColorStop(1, el.colorSecondary);

    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.clip();

    if (spec.surfaceStyle === 'gas-bands') {
      ctx.fillStyle = withAlpha(el.colorSecondary, 0.38);
      for (let b = -3; b <= 3; b++) {
        ctx.fillRect(px - r, py + b * r * 0.26, r * 2, r * 0.11);
      }
    } else if (spec.surfaceStyle === 'earth-like') {
      ctx.fillStyle = withAlpha('#22c55e', 0.65);
      ctx.beginPath();
      ctx.ellipse(px - r * 0.25, py - r * 0.15, r * 0.35, r * 0.22, 0.3, 0, Math.PI * 2);
      ctx.ellipse(px + r * 0.28, py + r * 0.2, r * 0.26, r * 0.32, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (spec.surfaceStyle === 'rocky' || spec.surfaceStyle === 'molten') {
      ctx.fillStyle = withAlpha(el.colorSecondary, 0.45);
      ctx.beginPath();
      ctx.arc(px - r * 0.3, py + r * 0.15, r * 0.18, 0, Math.PI * 2);
      ctx.arc(px + r * 0.25, py - r * 0.25, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Front half of planetary rings
    if (spec.hasRings) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-0.28);
      ctx.strokeStyle = withAlpha(spec.ringColor, 0.85);
      ctx.lineWidth = Math.max(2, r * 0.22);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 2.05, r * 0.55, 0, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (spec.showLabel) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 ${Math.round(clamp(r * 0.42, 10, 14))}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(el.label, px, py + r + 8);
  }
}

function drawTextElement(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  px: number,
  py: number,
  w: number,
  h: number,
  t: number,
  normT: number
): void {
  const spec: TextSpec = el.textSpec || {
    text: el.label,
    subtext: '',
    fontSize: 'lg',
    align: 'center',
    revealEffect: 'fade-in',
    showBackdrop: false,
  };

  const sizeMap: Record<TextSpec['fontSize'], number> = {
    sm: Math.round(clamp(h * 0.025 * el.scale, 12, 22)),
    md: Math.round(clamp(h * 0.036 * el.scale, 16, 32)),
    lg: Math.round(clamp(h * 0.052 * el.scale, 22, 48)),
    xl: Math.round(clamp(h * 0.072 * el.scale, 28, 66)),
    hero: Math.round(clamp(h * 0.095 * el.scale, 34, 88)),
  };
  const fontSize = sizeMap[spec.fontSize];

  let alpha = 1;
  let offsetY = 0;
  let scale = 1;
  let displayText = spec.text;

  const intro = clamp(normT / 0.28, 0, 1);
  if (spec.revealEffect === 'fade-in') {
    alpha = intro;
  } else if (spec.revealEffect === 'slide-up') {
    alpha = intro;
    offsetY = (1 - intro) * 24;
  } else if (spec.revealEffect === 'scale-pop') {
    alpha = intro;
    scale = 0.72 + 0.28 * Math.min(1.06, intro * 1.15);
  } else if (spec.revealEffect === 'typewriter') {
    const chars = Math.max(1, Math.round(spec.text.length * clamp(normT / 0.55, 0, 1)));
    displayText = spec.text.slice(0, chars);
  } else if (spec.revealEffect === 'glow-pulse') {
    ctx.shadowColor = el.accentColor;
    ctx.shadowBlur = 14 + Math.sin(t * 4) * 8;
  }

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(px, py + offsetY);
  ctx.scale(scale, scale);

  ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = spec.align;
  ctx.textBaseline = 'middle';

  if (spec.showBackdrop) {
    const tw = ctx.measureText(displayText).width + 36;
    const bh = fontSize * (spec.subtext ? 2.4 : 1.7);
    const bx = spec.align === 'center' ? -tw / 2 : spec.align === 'right' ? -tw : 0;
    ctx.fillStyle = withAlpha(el.colorSecondary, 0.8);
    ctx.strokeStyle = withAlpha(el.accentColor, 0.45);
    ctx.lineWidth = 1.5;
    roundedRect(ctx, bx, -bh / 2, tw, bh, 12);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = el.colorPrimary;
  ctx.fillText(displayText, 0, spec.subtext ? -fontSize * 0.35 : 0);

  if (spec.subtext && intro > 0.35) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = el.accentColor;
    ctx.font = `500 ${Math.round(fontSize * 0.48)}px Inter, system-ui, sans-serif`;
    ctx.fillText(spec.subtext, 0, fontSize * 0.55);
  }

  ctx.restore();
}

function drawLogoElement(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  px: number,
  py: number,
  w: number,
  h: number,
  t: number,
  normT: number
): void {
  const spec: LogoSpec = el.logoSpec || {
    brandText: el.label,
    tagline: '',
    emblemShape: 'wing-v',
    revealStyle: 'assemble',
  };

  const reveal = clamp(normT / 0.45, 0, 1);
  const eased = 1 - Math.pow(1 - reveal, 3);
  const emblemR = Math.min(w, h) * 0.13 * el.scale;
  const centerY = py - (spec.brandText ? emblemR * 0.55 : 0);

  ctx.save();
  ctx.translate(px, centerY);
  const scaleFactor =
    spec.revealStyle === 'burst'
      ? 0.4 + 0.6 * eased
      : spec.revealStyle === 'assemble'
      ? 0.8 + 0.2 * eased
      : 1;
  ctx.scale(scaleFactor, scaleFactor);
  ctx.globalAlpha *= clamp(reveal * 1.4, 0, 1);

  // Outer energy ring behind emblem
  ctx.strokeStyle = withAlpha(el.accentColor, 0.35 + 0.2 * Math.sin(t * 3));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, emblemR * 1.4, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * eased);
  ctx.stroke();

  // Emblem Vector Crest
  ctx.fillStyle = el.colorPrimary;
  ctx.strokeStyle = el.accentColor;
  ctx.lineWidth = Math.max(2.5, emblemR * 0.08);
  ctx.shadowColor = el.accentColor;
  ctx.shadowBlur = 22 * (0.6 + 0.4 * Math.sin(t * 3.2));

  ctx.beginPath();
  if (spec.emblemShape === 'hexagon') {
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 - Math.PI / 6;
      const hx = Math.cos(a) * emblemR;
      const hy = Math.sin(a) * emblemR;
      if (k === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
  } else if (spec.emblemShape === 'diamond' || spec.emblemShape === 'prism') {
    ctx.moveTo(0, -emblemR);
    ctx.lineTo(emblemR * 0.85, 0);
    ctx.lineTo(0, emblemR);
    ctx.lineTo(-emblemR * 0.85, 0);
    ctx.closePath();
  } else if (spec.emblemShape === 'shield') {
    ctx.moveTo(-emblemR * 0.8, -emblemR * 0.75);
    ctx.lineTo(emblemR * 0.8, -emblemR * 0.75);
    ctx.lineTo(emblemR * 0.72, emblemR * 0.2);
    ctx.lineTo(0, emblemR * 0.98);
    ctx.lineTo(-emblemR * 0.72, emblemR * 0.2);
    ctx.closePath();
  } else if (spec.emblemShape === 'orbit') {
    ctx.arc(0, 0, emblemR * 0.55, 0, Math.PI * 2);
  } else if (spec.emblemShape === 'crown') {
    ctx.moveTo(-emblemR * 0.85, emblemR * 0.55);
    ctx.lineTo(-emblemR * 0.85, -emblemR * 0.35);
    ctx.lineTo(-emblemR * 0.32, emblemR * 0.1);
    ctx.lineTo(0, -emblemR * 0.75);
    ctx.lineTo(emblemR * 0.32, emblemR * 0.1);
    ctx.lineTo(emblemR * 0.85, -emblemR * 0.35);
    ctx.lineTo(emblemR * 0.85, emblemR * 0.55);
    ctx.closePath();
  } else {
    // Wing-V / default sharp geometric emblem
    ctx.moveTo(-emblemR * 0.85, -emblemR * 0.65);
    ctx.lineTo(-emblemR * 0.35, -emblemR * 0.65);
    ctx.lineTo(0, emblemR * 0.35);
    ctx.lineTo(emblemR * 0.35, -emblemR * 0.65);
    ctx.lineTo(emblemR * 0.85, -emblemR * 0.65);
    ctx.lineTo(0, emblemR * 0.92);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  if (spec.emblemShape === 'orbit' || spec.emblemShape === 'circuit') {
    ctx.beginPath();
    ctx.ellipse(0, 0, emblemR * 1.15, emblemR * 0.42, t * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();

  // Brand Title & Tagline Reveal
  const textFade = clamp((normT - 0.18) / 0.32, 0, 1);
  if (spec.brandText && textFade > 0) {
    ctx.save();
    ctx.globalAlpha *= textFade;
    const titleY = centerY + emblemR * 1.48 + (1 - textFade) * 14;
    const brandSize = Math.round(clamp(h * 0.068 * el.scale, 24, 62));
    ctx.font = `800 ${brandSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(spec.brandText, px, titleY);

    if (spec.tagline && normT > 0.32) {
      const tagFade = clamp((normT - 0.32) / 0.25, 0, 1);
      ctx.globalAlpha *= tagFade;
      ctx.fillStyle = el.accentColor;
      ctx.font = `500 ${Math.round(brandSize * 0.36)}px Inter, system-ui, sans-serif`;
      ctx.fillText(spec.tagline, px, titleY + brandSize * 0.78);
    }
    ctx.restore();
  }
}

function drawRoadElement(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  scene: SceneSegment,
  groundY: number,
  w: number,
  h: number,
  t: number
): void {
  const spec: RoadSpec = el.roadSpec || {
    perspective: 'flat',
    lanes: 2,
    scrollSpeed: 2,
    wetReflections: false,
  };

  const roadTop = Math.min(groundY, h * el.y);
  const roadH = Math.max(h * 0.18, h - roadTop);

  ctx.save();
  // Asphalt deck
  const roadGrad = ctx.createLinearGradient(0, roadTop, 0, h);
  roadGrad.addColorStop(0, el.colorSecondary);
  roadGrad.addColorStop(1, '#020617');
  ctx.fillStyle = roadGrad;
  ctx.fillRect(0, roadTop, w, roadH);

  // Top curb / neon edge
  ctx.fillStyle = el.accentColor;
  ctx.fillRect(0, roadTop, w, 3);

  // Scrolling dashed lane markings
  const dashStep = 90;
  const shift = ((t * 140 * spec.scrollSpeed) % dashStep + dashStep) % dashStep;
  ctx.fillStyle = el.colorPrimary;
  for (let lane = 1; lane < Math.max(2, spec.lanes); lane++) {
    const ly = roadTop + (lane / Math.max(2, spec.lanes)) * roadH;
    for (let x = -dashStep; x < w + dashStep; x += dashStep) {
      ctx.fillRect(x - shift, ly - 3, 46, 5);
    }
  }

  // Wet cyberpunk puddle reflections
  if (spec.wetReflections || spec.perspective === 'wet-neon' || scene.weather.type === 'rain') {
    for (let r = 0; r < 14; r++) {
      const rx = ((r * 137 + t * 40 * spec.scrollSpeed) % (w + 60) + (w + 60)) % (w + 60) - 30;
      const ry = roadTop + 14 + (r % 4) * (roadH * 0.22);
      ctx.fillStyle = withAlpha(
        r % 2 === 0 ? el.accentColor : scene.lighting.bloomColor,
        0.22
      );
      ctx.fillRect(rx, ry, 5 + (r % 3) * 4, roadH * 0.16);
    }
  }
  ctx.restore();
}

function drawParticleBurst(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  px: number,
  py: number,
  unit: number,
  t: number
): void {
  const n = Math.max(6, el.count * 3);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + t * 0.6 * el.motion.direction;
    const life = ((t * Math.max(0.5, Math.abs(el.motion.speed)) + i * 0.17) % 1);
    const dist = unit * (0.2 + life * 1.9);
    const x = px + Math.cos(angle) * dist;
    const y = py + Math.sin(angle) * dist - life * unit * 0.4;
    ctx.fillStyle = withAlpha(i % 2 === 0 ? el.accentColor : el.colorPrimary, 1 - life);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, unit * 0.08 * (1 - life * 0.6)), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawContextualProp(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  px: number,
  py: number,
  unit: number,
  t: number
): void {
  const lbl = el.label.toLowerCase();
  for (let i = 0; i < el.count; i++) {
    const ox = px + i * unit * 0.95;
    const oy = py;

    if (/\blamp|streetlight|post|pole\b/.test(lbl)) {
      ctx.fillStyle = el.colorSecondary;
      ctx.fillRect(ox - unit * 0.05, oy - unit * 1.3, unit * 0.1, unit * 1.35);
      ctx.fillRect(ox - unit * 0.05, oy - unit * 1.3, unit * 0.42, unit * 0.08);
      ctx.fillStyle = el.accentColor;
      ctx.shadowColor = el.accentColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(ox + unit * 0.34, oy - unit * 1.22, unit * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (/\bsign|billboard|holo|neon|screen\b/.test(lbl)) {
      ctx.fillStyle = el.colorSecondary;
      ctx.fillRect(ox - unit * 0.05, oy - unit * 0.4, unit * 0.1, unit * 0.75);
      ctx.fillStyle = withAlpha(el.colorPrimary, 0.85);
      ctx.strokeStyle = el.accentColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = el.accentColor;
      ctx.shadowBlur = 10 + 4 * Math.sin(t * 4);
      roundedRect(ctx, ox - unit * 0.55, oy - unit * 0.95, unit * 1.1, unit * 0.56, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (/\bbarrel|crate|debris|rubble|barrier|wreck\b/.test(lbl)) {
      ctx.fillStyle = el.colorPrimary;
      ctx.strokeStyle = el.colorSecondary;
      ctx.lineWidth = 1.6;
      roundedRect(ctx, ox - unit * 0.28, oy - unit * 0.32, unit * 0.56, unit * 0.36, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = el.accentColor;
      ctx.fillRect(ox - unit * 0.26, oy - unit * 0.16, unit * 0.52, unit * 0.06);
    } else {
      ctx.fillStyle = el.colorPrimary;
      ctx.strokeStyle = el.accentColor;
      ctx.lineWidth = 1.5;
      roundedRect(ctx, ox - unit * 0.32, oy - unit * 0.26, unit * 0.64, unit * 0.42, unit * 0.08);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawWeather(
  ctx: CanvasRenderingContext2D,
  scene: SceneSegment,
  w: number,
  h: number,
  t: number
): void {
  const { type, density, windX } = scene.weather;
  if (type === 'none' || density <= 0) return;

  const count = Math.round(density * 110);
  ctx.save();

  if (type === 'rain') {
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.48)';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < count; i++) {
      const rx = ((i * 97 + t * (280 + windX * 180)) % (w + 100) + (w + 100)) % (w + 100) - 50;
      const ry = ((i * 61 + t * 760) % (h + 100)) - 50;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + windX * 14 - 4, ry + 24);
      ctx.stroke();
    }
  } else if (type === 'snow') {
    ctx.fillStyle = 'rgba(241, 245, 249, 0.75)';
    for (let i = 0; i < count; i++) {
      const sx = ((i * 83 + t * (45 + windX * 50) + Math.sin(t + i) * 18) % w + w) % w;
      const sy = (i * 53 + t * 90) % h;
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 3) + 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'ash' || type === 'sparks') {
    for (let i = 0; i < count; i++) {
      const ax = ((i * 79 + t * (55 + windX * 60) + Math.sin(t * 2 + i) * 20) % w + w) % w;
      const ay = h - ((i * 47 + t * 75) % h);
      ctx.fillStyle =
        type === 'sparks' || i % 3 === 0
          ? 'rgba(251, 146, 60, 0.85)'
          : 'rgba(148, 163, 184, 0.5)';
      ctx.beginPath();
      ctx.arc(ax, ay, (i % 2) + 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'stars') {
    ctx.fillStyle = '#e0f2fe';
    for (let i = 0; i < count; i++) {
      const sx = (i * 137 + t * 8) % w;
      const sy = (i * 89) % (h * 0.88);
      const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
      ctx.globalAlpha = alpha;
      ctx.fillRect(sx, sy, (i % 2) + 1.5, (i % 2) + 1.5);
    }
  } else if (type === 'fog') {
    const fogGrad = ctx.createLinearGradient(0, h * 0.45, 0, h);
    fogGrad.addColorStop(0, 'rgba(148, 163, 184, 0)');
    fogGrad.addColorStop(0.65, `rgba(148, 163, 184, ${0.28 * density})`);
    fogGrad.addColorStop(1, `rgba(30, 41, 59, ${0.5 * density})`);
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, h * 0.4, w, h * 0.6);
  }

  ctx.restore();
}

function drawLightingOverlay(
  ctx: CanvasRenderingContext2D,
  scene: SceneSegment,
  w: number,
  h: number
): void {
  ctx.save();
  const { mood, ambientAlpha, bloomColor, volumetricRays, vignette } = scene.lighting;

  if (mood === 'neon') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, withAlpha(bloomColor, 0.15));
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.13)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (mood === 'golden-hour') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(251, 146, 60, 0.2)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.27)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (mood === 'noir') {
    ctx.fillStyle = `rgba(2, 6, 23, ${Math.max(0.25, ambientAlpha)})`;
    ctx.fillRect(0, 0, w, h);
  } else if (mood === 'eerie-ash') {
    ctx.fillStyle = 'rgba(67, 20, 7, 0.22)';
    ctx.fillRect(0, 0, w, h);
  }

  if (volumetricRays) {
    const rayGrad = ctx.createLinearGradient(w * 0.2, 0, w * 0.7, h * 0.85);
    rayGrad.addColorStop(0, withAlpha(bloomColor, 0.16));
    rayGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, 0);
    ctx.lineTo(w * 0.42, 0);
    ctx.lineTo(w * 0.82, h);
    ctx.lineTo(w * 0.35, h);
    ctx.closePath();
    ctx.fill();
  }

  if (vignette > 0) {
    const vig = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.3,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(2, 6, 23, ${clamp(vignette * 0.75, 0, 0.8)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}
