import * as THREE from 'three';
import { Camera3DSpec } from '../../shared/sceneSchema';

const _desiredPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _startPos = new THREE.Vector3();
const _endPos = new THREE.Vector3();
const _startTarget = new THREE.Vector3();
const _endTarget = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _proj = new THREE.Vector3();

export interface CameraEvaluationContext {
  camera3d: Camera3DSpec;
  localTimeSec: number;
  segmentDurationSec: number;
  followObject?: THREE.Object3D;
  smoothDampDeltaSec?: number; // When >0 uses THREE.MathUtils.damp; when undefined/0 snaps deterministically
}

export function evaluateCameraRig(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  currentTarget: THREE.Vector3,
  ctx: CameraEvaluationContext
): void {
  const { camera3d, localTimeSec, segmentDurationSec, followObject, smoothDampDeltaSec } = ctx;
  const progress = Math.max(
    0,
    Math.min(1, localTimeSec / Math.max(0.1, segmentDurationSec))
  );
  // Smooth ease-in-out curve for camera transitions
  const eased =
    progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  _startPos.set(camera3d.position.x, camera3d.position.y, camera3d.position.z);
  _startTarget.set(camera3d.target.x, camera3d.target.y, camera3d.target.z);

  if (camera3d.endPosition) {
    _endPos.set(camera3d.endPosition.x, camera3d.endPosition.y, camera3d.endPosition.z);
  } else {
    _endPos.copy(_startPos);
  }

  if (camera3d.endTarget) {
    _endTarget.set(camera3d.endTarget.x, camera3d.endTarget.y, camera3d.endTarget.z);
  } else {
    _endTarget.copy(_startTarget);
  }

  if (camera3d.motion === 'orbit') {
    const baseTarget = followObject ? followObject.position : _startTarget;
    _desiredTarget.copy(baseTarget);
    if (!followObject && camera3d.target.y > 0) {
      _desiredTarget.y = camera3d.target.y;
    }

    const dx = _startPos.x - _desiredTarget.x;
    const dz = _startPos.z - _desiredTarget.z;
    const radius = Math.max(
      0.15,
      camera3d.orbitRadius > 0 ? camera3d.orbitRadius : Math.hypot(dx, dz) || 7
    );
    const startAngle = Math.atan2(dx, dz);
    const angle = startAngle + localTimeSec * camera3d.orbitSpeed;

    _desiredPos.set(
      _desiredTarget.x + Math.sin(angle) * radius,
      _startPos.y,
      _desiredTarget.z + Math.cos(angle) * radius
    );
  } else if (
    (camera3d.motion === 'follow-subject' || camera3d.motion === 'tracking') &&
    followObject
  ) {
    const subjectPos = followObject.position;
    if (camera3d.followOffset) {
      _offset.set(
        camera3d.followOffset.x,
        camera3d.followOffset.y,
        camera3d.followOffset.z
      );
    } else {
      // Preserve initial relative offset or use clean cinematic tracking offset
      _offset.set(
        _startPos.x - _startTarget.x,
        _startPos.y - _startTarget.y,
        _startPos.z - _startTarget.z
      );
      if (_offset.lengthSq() < 0.5) {
        _offset.set(4.5, 2.8, 8.5);
      }
    }
    _desiredTarget.set(
      subjectPos.x,
      Math.max(0.6, subjectPos.y + 1.0),
      subjectPos.z
    );
    if (camera3d.endPosition) {
      // Blend endPosition delta if explicitly scripted
      _desiredPos.copy(_desiredTarget).add(_offset).lerp(_endPos, eased * 0.35);
    } else {
      _desiredPos.copy(_desiredTarget).add(_offset);
    }
  } else if (camera3d.motion === 'dolly-in') {
    _desiredTarget.copy(_startTarget).lerp(_endTarget, eased);
    if (camera3d.endPosition) {
      _desiredPos.copy(_startPos).lerp(_endPos, eased);
    } else {
      _desiredPos.copy(_startPos).lerp(_desiredTarget, eased * 0.52);
    }
  } else if (camera3d.motion === 'dolly-out') {
    _desiredTarget.copy(_startTarget).lerp(_endTarget, eased);
    if (camera3d.endPosition) {
      _desiredPos.copy(_startPos).lerp(_endPos, eased);
    } else {
      _offset.copy(_startPos).sub(_startTarget).multiplyScalar(1 + eased * 0.85);
      _desiredPos.copy(_desiredTarget).add(_offset);
    }
  } else if (camera3d.motion === 'pan') {
    if (camera3d.endPosition || camera3d.endTarget) {
      _desiredPos.copy(_startPos).lerp(_endPos, eased);
      _desiredTarget.copy(_startTarget).lerp(_endTarget, eased);
    } else {
      const sweep = Math.sin((progress - 0.5) * Math.PI) * 6;
      _desiredPos.set(_startPos.x + sweep * 0.35, _startPos.y, _startPos.z);
      _desiredTarget.set(_startTarget.x + sweep, _startTarget.y, _startTarget.z);
    }
  } else if (camera3d.motion === 'tilt') {
    _desiredPos.copy(_startPos).lerp(_endPos, eased);
    if (camera3d.endTarget) {
      _desiredTarget.copy(_startTarget).lerp(_endTarget, eased);
    } else {
      _desiredTarget.set(_startTarget.x, _startTarget.y + eased * 6, _startTarget.z);
    }
  } else if (camera3d.motion === 'flythrough') {
    _desiredPos.copy(_startPos).lerp(_endPos, eased);
    _desiredTarget.copy(_startTarget).lerp(_endTarget, eased);
  } else {
    // static or explicit endPosition interpolation if provided
    _desiredPos.copy(_startPos).lerp(_endPos, eased);
    _desiredTarget.copy(_startTarget).lerp(_endTarget, eased);
  }

  if (smoothDampDeltaSec && smoothDampDeltaSec > 0) {
    const lambda = 9;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredPos.x, lambda, smoothDampDeltaSec);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredPos.y, lambda, smoothDampDeltaSec);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredPos.z, lambda, smoothDampDeltaSec);
    currentTarget.x = THREE.MathUtils.damp(currentTarget.x, _desiredTarget.x, lambda, smoothDampDeltaSec);
    currentTarget.y = THREE.MathUtils.damp(currentTarget.y, _desiredTarget.y, lambda, smoothDampDeltaSec);
    currentTarget.z = THREE.MathUtils.damp(currentTarget.z, _desiredTarget.z, lambda, smoothDampDeltaSec);
  } else {
    camera.position.copy(_desiredPos);
    currentTarget.copy(_desiredTarget);
  }

  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const pCam = camera as THREE.PerspectiveCamera;
    if (Math.abs(pCam.fov - camera3d.fov) > 0.05) {
      pCam.fov = camera3d.fov;
      pCam.updateProjectionMatrix();
    }
  }

  camera.lookAt(currentTarget);
  camera.updateMatrixWorld(true);
}

export interface ProjectedPoint2D {
  ndcX: number;
  ndcY: number;
  ndcZ: number;
  screenX: number;
  screenY: number;
  inFront: boolean;
  distanceToCamera: number;
}

export function projectWorldPoint(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  viewportWidth: number,
  viewportHeight: number
): ProjectedPoint2D {
  _proj.copy(worldPos).project(camera);
  return {
    ndcX: _proj.x,
    ndcY: _proj.y,
    ndcZ: _proj.z,
    screenX: ((_proj.x + 1) / 2) * viewportWidth,
    screenY: ((-_proj.y + 1) / 2) * viewportHeight,
    inFront: _proj.z >= -1 && _proj.z <= 1,
    distanceToCamera: worldPos.distanceTo(camera.position),
  };
}

/**
 * Frames a perspective camera from an object's world bounding box so the
 * object fills roughly `targetFillFraction` (~50%) of the viewport in a wide shot.
 */
export function frameCameraForBoundingBox(
  box: THREE.Box3,
  fovDeg: number,
  aspect: number,
  viewDirection?: THREE.Vector3,
  targetFillFraction = 0.5
): { position: THREE.Vector3; target: THREE.Vector3; distance: number } {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  if (box.isEmpty()) {
    return {
      position: new THREE.Vector3(6, 3, 8),
      target: new THREE.Vector3(0, 1, 0),
      distance: 10,
    };
  }

  box.getCenter(center);
  box.getSize(size);

  const dir = viewDirection ? viewDirection.clone() : new THREE.Vector3(0.65, 0.28, 0.7);
  if (dir.lengthSq() < 1e-5) {
    dir.set(0.65, 0.28, 0.7);
  }
  dir.normalize();
  if (Math.abs(dir.y) > 0.96) {
    dir.z += 0.28;
    dir.normalize();
  }

  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(worldUp, dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();

  const hx = Math.max(0.05, size.x * 0.5);
  const hy = Math.max(0.05, size.y * 0.5);
  const hz = Math.max(0.05, size.z * 0.5);

  const corners: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corners.push(new THREE.Vector3(sx * hx, sy * hy, sz * hz));
      }
    }
  }

  const safeAspect = Math.max(0.25, aspect || 16 / 9);
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(Math.max(18, Math.min(110, fovDeg))) * 0.5);
  const fill = Math.max(0.15, Math.min(0.9, targetFillFraction));

  let maxDepthOffset = 0;
  for (const c of corners) {
    maxDepthOffset = Math.max(maxDepthOffset, c.dot(dir));
  }

  const measureFillAtDistance = (dist: number): number => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of corners) {
      const zFromCam = Math.max(0.1, dist - c.dot(dir));
      const xNdc = c.dot(right) / (zFromCam * tanHalfFov * safeAspect);
      const yNdc = c.dot(up) / (zFromCam * tanHalfFov);
      if (xNdc < minX) minX = xNdc;
      if (xNdc > maxX) maxX = xNdc;
      if (yNdc < minY) minY = yNdc;
      if (yNdc > maxY) maxY = yNdc;
    }
    const widthFill = (maxX - minX) * 0.5;
    const heightFill = (maxY - minY) * 0.5;
    return Math.max(widthFill, heightFill);
  };

  let lo = maxDepthOffset + 0.25;
  let hi = Math.max(lo + 1, (Math.max(size.x, size.y, size.z) * 4) / Math.max(0.1, tanHalfFov * fill));
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) * 0.5;
    if (measureFillAtDistance(mid) > fill) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const distance = (lo + hi) * 0.5;
  const position = center.clone().addScaledVector(dir, distance);
  if (position.y < 0.35 && center.y >= 0.2) {
    position.y = 0.35;
  }

  return { position, target: center, distance };
}

export interface CustomEstablishingFrameResult {
  position: THREE.Vector3;
  target: THREE.Vector3;
  distance: number;
  boundingSphere: THREE.Sphere;
  horizontalAngleFromLongestDeg: number;
}

/**
 * Builds an establishing 3/4 camera for a custom 3D subject from its world bounding box/sphere:
 * - Placed ~60 degrees from the subject's longest horizontal axis (never straight along it)
 * - Slightly above subject center, looking directly at subject center
 * - At a distance where the bounding sphere fills ~50% of the frame width
 */
export function frameCustomEstablishingCamera(
  box: THREE.Box3,
  fovDeg: number,
  aspect: number,
  options?: {
    hintDirection?: THREE.Vector3;
    targetWidthFill?: number;
    angleFromLongestDeg?: number;
    elevationDeg?: number;
  }
): CustomEstablishingFrameResult {
  const boundingSphere = new THREE.Sphere();
  if (box.isEmpty()) {
    boundingSphere.set(new THREE.Vector3(0, 1, 0), 1);
    return {
      position: new THREE.Vector3(4, 2, 6),
      target: new THREE.Vector3(0, 1, 0),
      distance: 7.48,
      boundingSphere,
      horizontalAngleFromLongestDeg: 60,
    };
  }

  box.getBoundingSphere(boundingSphere);
  const center = boundingSphere.center.clone();
  const radius = Math.max(0.02, boundingSphere.radius);
  const size = new THREE.Vector3();
  box.getSize(size);

  const longestIsX = size.x >= size.z;
  const angleDeg = Math.max(40, Math.min(75, options?.angleFromLongestDeg ?? 60));
  const angleRad = THREE.MathUtils.degToRad(angleDeg);
  const elevDeg = Math.max(8, Math.min(28, options?.elevationDeg ?? 16));
  const elevRad = THREE.MathUtils.degToRad(elevDeg);

  const hint = options?.hintDirection;
  const signX = hint && Math.abs(hint.x) > 0.05 ? Math.sign(hint.x) : 1;
  const signZ = hint && Math.abs(hint.z) > 0.05 ? Math.sign(hint.z) : 1;

  const hx = longestIsX
    ? Math.cos(angleRad) * signX
    : Math.sin(angleRad) * signX;
  const hz = longestIsX
    ? Math.sin(angleRad) * signZ
    : Math.cos(angleRad) * signZ;

  const cosElev = Math.cos(elevRad);
  const sinElev = Math.sin(elevRad);
  const dir = new THREE.Vector3(hx * cosElev, sinElev, hz * cosElev).normalize();

  const horizLen = Math.hypot(dir.x, dir.z) || 1;
  const cosLongest = Math.min(
    1,
    Math.abs(longestIsX ? dir.x : dir.z) / horizLen
  );
  const horizontalAngleFromLongestDeg = THREE.MathUtils.radToDeg(
    Math.acos(cosLongest)
  );

  const safeAspect = Math.max(0.25, aspect || 16 / 9);
  const tanHalfV = Math.tan(
    THREE.MathUtils.degToRad(Math.max(18, Math.min(110, fovDeg))) * 0.5
  );
  const tanHalfH = tanHalfV * safeAspect;
  const widthFill = Math.max(0.2, Math.min(0.85, options?.targetWidthFill ?? 0.5));

  // Exact perspective distance where the bounding sphere's silhouette spans `widthFill` of frame width
  const halfHorizAngle = Math.atan(widthFill * tanHalfH);
  let distance = radius / Math.max(0.05, Math.sin(halfHorizAngle));

  // Guard vertical framing for very tall, narrow subjects so they never clip top/bottom
  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(worldUp, dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  const projHalfH =
    Math.abs(up.x) * (size.x * 0.5) +
    Math.abs(up.y) * (size.y * 0.5) +
    Math.abs(up.z) * (size.z * 0.5);
  const projHalfDepth =
    Math.abs(dir.x) * (size.x * 0.5) +
    Math.abs(dir.y) * (size.y * 0.5) +
    Math.abs(dir.z) * (size.z * 0.5);
  const minDistForHeight = projHalfH / (0.86 * tanHalfV) + projHalfDepth;

  distance = Math.max(radius * 1.25, distance, minDistForHeight);
  const position = center.clone().addScaledVector(dir, distance);

  return {
    position,
    target: center,
    distance,
    boundingSphere,
    horizontalAngleFromLongestDeg,
  };
}

export interface CustomCloseUpFrameResult {
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  target: THREE.Vector3;
  endTarget: THREE.Vector3;
  partSize: number;
  startDistance: number;
  endDistance: number;
}

/**
 * Builds a close-up dolly camera targeting a custom subject's focus part:
 * - Approaches from the outer side of the focus part (outside the body)
 * - Ends at ~1.5x the focus part's size
 * - Always keeps lookAt locked on the focus part center from start to end
 */
export function frameCustomCloseUpCamera(
  subjectBox: THREE.Box3,
  focusPartBox: THREE.Box3,
  _fovDeg: number,
  _aspect: number,
  options?: {
    hintDirection?: THREE.Vector3;
    endDistanceMultiplier?: number;
  }
): CustomCloseUpFrameResult {
  const effectivePartBox = focusPartBox.isEmpty() ? subjectBox : focusPartBox;
  const partCenter = new THREE.Vector3();
  const partDims = new THREE.Vector3();
  effectivePartBox.getCenter(partCenter);
  effectivePartBox.getSize(partDims);

  const partSize = Math.max(0.04, Math.max(partDims.x, partDims.y, partDims.z));
  const endMult = Math.max(0.8, Math.min(4.0, options?.endDistanceMultiplier ?? 1.5));
  const endDistance = Math.max(0.08, partSize * endMult);

  const subjectCenter = new THREE.Vector3();
  const subjectSize = new THREE.Vector3();
  const subjectSphere = new THREE.Sphere();
  if (!subjectBox.isEmpty()) {
    subjectBox.getCenter(subjectCenter);
    subjectBox.getSize(subjectSize);
    subjectBox.getBoundingSphere(subjectSphere);
  } else {
    subjectCenter.copy(partCenter);
    subjectSize.copy(partDims);
    subjectSphere.set(partCenter, partSize * 0.5);
  }

  const outwardX = partCenter.x - subjectCenter.x;
  const outwardZ = partCenter.z - subjectCenter.z;
  const longestIsX = subjectSize.x >= subjectSize.z;
  const hint = options?.hintDirection;

  let approachDir: THREE.Vector3;
  if (longestIsX && Math.abs(outwardZ) > 0.015) {
    const zSign = Math.sign(outwardZ);
    const xSign = Math.abs(outwardX) > 0.015 ? Math.sign(outwardX) : 1;
    approachDir = new THREE.Vector3(0.36 * xSign, 0.14, 0.92 * zSign).normalize();
  } else if (!longestIsX && Math.abs(outwardX) > 0.015) {
    const xSign = Math.sign(outwardX);
    const zSign = Math.abs(outwardZ) > 0.015 ? Math.sign(outwardZ) : 1;
    approachDir = new THREE.Vector3(0.92 * xSign, 0.14, 0.36 * zSign).normalize();
  } else if (Math.hypot(outwardX, outwardZ) > 0.015) {
    approachDir = new THREE.Vector3(outwardX, 0.14 * Math.hypot(outwardX, outwardZ), outwardZ).normalize();
  } else if (hint && hint.lengthSq() > 0.01) {
    approachDir = new THREE.Vector3(hint.x, Math.max(0.12, hint.y), hint.z).normalize();
  } else {
    approachDir = new THREE.Vector3(0.5, 0.18, 0.85).normalize();
  }

  const startDistance = Math.max(
    endDistance * 3.0,
    Math.min(
      Math.max(endDistance * 5.5, subjectSphere.radius * 1.1),
      Math.max(endDistance * 8.0, subjectSphere.radius * 1.6)
    )
  );

  const startPosition = partCenter.clone().addScaledVector(approachDir, startDistance);
  const endPosition = partCenter.clone().addScaledVector(approachDir, endDistance);

  return {
    startPosition,
    endPosition,
    target: partCenter.clone(),
    endTarget: partCenter.clone(),
    partSize,
    startDistance,
    endDistance,
  };
}

export interface ResolvedCustomFocusPart {
  partObject: THREE.Object3D;
  partId: string;
  matchedAiFocusPart: boolean;
  source: 'ai-focusPartId' | 'fallback-eye' | 'fallback-head-max-x' | 'fallback-root';
}

/**
 * Resolves the target focus part for a custom 3D subject:
 * 1. Exact match for `focusPartId` if valid.
 * 2. Fallback to the first part whose id contains "eye", preferring the one closest
 *    to `startCameraPosition` (and preferring outer sclera/eye over a co-located pupil).
 * 3. Fallback to the part with the highest world X coordinate (head).
 */
export function resolveCustomFocusPart(
  customRoot: THREE.Object3D,
  focusPartId: string | undefined,
  startCameraPosition: THREE.Vector3
): ResolvedCustomFocusPart {
  customRoot.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];
  customRoot.traverse((child) => {
    const asMesh = child as THREE.Mesh;
    if (asMesh.isMesh && !child.userData?.isOutline) {
      meshes.push(asMesh);
    }
  });

  if (focusPartId) {
    const exact = meshes.find((m) => m.name === focusPartId);
    if (exact) {
      return {
        partObject: exact,
        partId: exact.name,
        matchedAiFocusPart: true,
        source: 'ai-focusPartId',
      };
    }
  }

  const tmpBox = new THREE.Box3();
  const tmpCenter = new THREE.Vector3();

  // Fallback 1: parts whose id contains "eye" (prefer closest to start camera)
  const eyeCandidates: Array<{
    mesh: THREE.Mesh;
    distToCam: number;
    isPupil: boolean;
    index: number;
  }> = [];

  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    const lowerName = mesh.name.toLowerCase();
    if (!lowerName.includes('eye')) continue;
    tmpBox.setFromObject(mesh);
    if (tmpBox.isEmpty()) continue;
    tmpBox.getCenter(tmpCenter);
    eyeCandidates.push({
      mesh,
      distToCam: tmpCenter.distanceTo(startCameraPosition),
      isPupil: lowerName.includes('pupil'),
      index: i,
    });
  }

  if (eyeCandidates.length > 0) {
    eyeCandidates.sort((a, b) => a.distToCam - b.distToCam || a.index - b.index);
    const closest = eyeCandidates[0];
    // If a non-pupil eye mesh (e.g. eye_sclera / eye_left) sits on the same side right next to
    // the closest pupil, prefer the full eye mesh so 1.5x framing captures the whole eye cleanly.
    const sameSideEye = eyeCandidates.find(
      (c) => !c.isPupil && c.distToCam <= closest.distToCam + 0.35
    );
    const chosen = sameSideEye ?? closest;
    return {
      partObject: chosen.mesh,
      partId: chosen.mesh.name,
      matchedAiFocusPart: false,
      source: 'fallback-eye',
    };
  }

  // Fallback 2: part with highest world X (head)
  let bestHead: THREE.Mesh | null = null;
  let bestCenterX = -Infinity;
  let bestMaxX = -Infinity;
  for (const mesh of meshes) {
    tmpBox.setFromObject(mesh);
    if (tmpBox.isEmpty()) continue;
    tmpBox.getCenter(tmpCenter);
    if (
      tmpCenter.x > bestCenterX + 1e-4 ||
      (Math.abs(tmpCenter.x - bestCenterX) <= 1e-4 && tmpBox.max.x > bestMaxX)
    ) {
      bestCenterX = tmpCenter.x;
      bestMaxX = tmpBox.max.x;
      bestHead = mesh;
    }
  }

  if (bestHead) {
    return {
      partObject: bestHead,
      partId: bestHead.name,
      matchedAiFocusPart: false,
      source: 'fallback-head-max-x',
    };
  }

  return {
    partObject: customRoot,
    partId: customRoot.name || 'custom_root',
    matchedAiFocusPart: false,
    source: 'fallback-root',
  };
}

export interface CustomFocusEndCameraResult {
  position: THREE.Vector3;
  target: THREE.Vector3;
  partSize: number;
  distance: number;
  approachDir: THREE.Vector3;
}

/**
 * Places the close-up end camera at ~1.5x the focus part's size, directly in front of
 * the side of the head that `startCameraPosition` was already viewing from, with
 * `lookAt` locked on the focus part center.
 */
export function frameCustomFocusEndCamera(
  subjectBox: THREE.Box3,
  focusPartBox: THREE.Box3,
  startCameraPosition: THREE.Vector3,
  options?: {
    endDistanceMultiplier?: number;
  }
): CustomFocusEndCameraResult {
  const effectivePartBox = focusPartBox.isEmpty() ? subjectBox : focusPartBox;
  const partCenter = new THREE.Vector3();
  const partDims = new THREE.Vector3();
  effectivePartBox.getCenter(partCenter);
  effectivePartBox.getSize(partDims);

  const partSize = Math.max(0.04, Math.max(partDims.x, partDims.y, partDims.z));
  const endMult = Math.max(0.8, Math.min(4.0, options?.endDistanceMultiplier ?? 1.5));
  const distance = Math.max(0.08, partSize * endMult);

  const subjectCenter = new THREE.Vector3();
  const subjectSize = new THREE.Vector3();
  if (!subjectBox.isEmpty()) {
    subjectBox.getCenter(subjectCenter);
    subjectBox.getSize(subjectSize);
  } else {
    subjectCenter.copy(partCenter);
    subjectSize.copy(partDims);
  }

  const startViewDir = startCameraPosition.clone().sub(subjectCenter);
  if (startViewDir.lengthSq() < 1e-5) {
    startViewDir.set(0.5, 0.2, 0.85);
  }
  startViewDir.normalize();

  const longestIsX = subjectSize.x >= subjectSize.z;
  const outwardX = partCenter.x - subjectCenter.x;
  const outwardZ = partCenter.z - subjectCenter.z;

  let approachDir: THREE.Vector3;
  if (longestIsX) {
    const lateralSign =
      Math.abs(outwardZ) > 0.015
        ? Math.sign(outwardZ)
        : Math.abs(startViewDir.z) > 0.05
        ? Math.sign(startViewDir.z)
        : 1;
    const forwardSign =
      Math.abs(outwardX) > 0.015
        ? Math.sign(outwardX)
        : Math.abs(startViewDir.x) > 0.05
        ? Math.sign(startViewDir.x)
        : 1;
    approachDir = new THREE.Vector3(
      0.32 * forwardSign,
      0.12,
      0.94 * lateralSign
    ).normalize();
  } else {
    const lateralSign =
      Math.abs(outwardX) > 0.015
        ? Math.sign(outwardX)
        : Math.abs(startViewDir.x) > 0.05
        ? Math.sign(startViewDir.x)
        : 1;
    const forwardSign =
      Math.abs(outwardZ) > 0.015
        ? Math.sign(outwardZ)
        : Math.abs(startViewDir.z) > 0.05
        ? Math.sign(startViewDir.z)
        : 1;
    approachDir = new THREE.Vector3(
      0.94 * lateralSign,
      0.12,
      0.32 * forwardSign
    ).normalize();
  }

  const position = partCenter.clone().addScaledVector(approachDir, distance);
  return {
    position,
    target: partCenter.clone(),
    partSize,
    distance,
    approachDir,
  };
}



