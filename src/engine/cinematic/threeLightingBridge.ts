import * as THREE from 'three';
import type { CinematicLightingPlan } from './lightingDirector';

/** Creates a disposable Three.js light/fog rig from the native cinematic lighting plan. */
export function createThreeLightingRig(plan: CinematicLightingPlan): THREE.Group {
  const rig = new THREE.Group();
  rig.name = 'VYROXX_Cinematic_Lighting';
  const ambient = new THREE.AmbientLight(plan.ambient.color, plan.ambient.intensity);
  ambient.name = 'VYROXX_Ambient';
  rig.add(ambient);

  const key = new THREE.DirectionalLight(plan.key.color, plan.key.intensity);
  key.name = 'VYROXX_Key';
  key.position.set(plan.key.position.x, plan.key.position.y, plan.key.position.z);
  rig.add(key);

  const fill = new THREE.PointLight(plan.fill.color, plan.fill.intensity, 80);
  fill.name = 'VYROXX_Fill';
  fill.position.set(plan.fill.position.x, plan.fill.position.y, plan.fill.position.z);
  rig.add(fill);

  const rim = new THREE.PointLight(plan.rim.color, plan.rim.intensity, 100);
  rim.name = 'VYROXX_Rim';
  rim.position.set(plan.rim.position.x, plan.rim.position.y, plan.rim.position.z);
  rig.add(rim);
  return rig;
}

/** Applies scene fog without replacing unrelated scene settings. */
export function applyThreeSceneFog(scene: THREE.Scene, plan: CinematicLightingPlan): void {
  scene.fog = plan.fog.density > 0
    ? new THREE.FogExp2(plan.fog.color, plan.fog.density)
    : null;
}

/** Removes a previously attached VYROXX rig and installs the new scene rig. */
export function replaceThreeLightingRig(scene: THREE.Scene, plan: CinematicLightingPlan): THREE.Group {
  const previous = scene.getObjectByName('VYROXX_Cinematic_Lighting');
  if (previous) {
    scene.remove(previous);
    previous.traverse((object) => {
      const light = object as THREE.Light;
      if (light.isLight) light.dispose?.();
    });
  }
  const rig = createThreeLightingRig(plan);
  scene.add(rig);
  applyThreeSceneFog(scene, plan);
  return rig;
}
