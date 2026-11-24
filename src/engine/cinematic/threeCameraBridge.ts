import * as THREE from 'three';
import type { CameraKeyframe } from './cameraDirector';

/** Applies a sampled native camera keyframe to an existing Three.js camera. */
export function applyCameraKeyframeToThree(camera: THREE.Camera, keyframe: CameraKeyframe): void {
  camera.position.set(keyframe.position.x, keyframe.position.y, keyframe.position.z);
  camera.lookAt(keyframe.target.x, keyframe.target.y, keyframe.target.z);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = keyframe.fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}

/** Creates a Three.js camera matching the sampled projection and pose. */
export function createThreeCameraFromKeyframe(
  keyframe: CameraKeyframe,
  aspect = 16 / 9,
  projection: 'perspective' | 'orthographic' = 'perspective'
): THREE.Camera {
  const camera: THREE.Camera = projection === 'orthographic'
    ? new THREE.OrthographicCamera(-8 * aspect, 8 * aspect, 8, -8, 0.1, 2000)
    : new THREE.PerspectiveCamera(keyframe.fov, aspect, 0.1, 2000);
  applyCameraKeyframeToThree(camera, keyframe);
  return camera;
}
