import * as THREE from 'three';
import {
  BuildingSpec3D,
  CharacterSpec,
  DroneSpec,
  PlanetSpec,
  ProductSpec3D,
  SceneElement,
  VehicleSpec,
} from '../../shared/sceneSchema';
import {
  createBrushedMetalTexture,
  createCarbonFiberTexture,
  createPlanetTexture,
  createSeededRng,
  createWindowFacadeTexture,
  hashSeed,
} from './materials';

export interface CharacterJointRig {
  type: 'character';
  pelvis: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  cloak?: THREE.Mesh;
  basePelvisY: number;
  pose: string;
}

export interface VehicleRigData {
  type: 'vehicle';
  subKind: VehicleSpec['subKind'];
  wheels: THREE.Object3D[];
  thrusters: THREE.Mesh[];
  rotors: THREE.Object3D[];
}

export interface DroneRigData {
  type: 'drone';
  rotors: THREE.Object3D[];
  searchlight?: THREE.Object3D;
}

export interface PlanetRigData {
  type: 'planet';
  bodyMesh: THREE.Mesh;
  cloudOrAtmosphere?: THREE.Mesh;
}

export interface ProductRigData {
  type: 'product';
  productGroup: THREE.Group;
  turntableSpin: boolean;
  secondHand?: THREE.Object3D;
}

export interface BuildingDoorwayInfo {
  hasDoorway: boolean;
  doorwayWidth: number;
  doorwayHeight: number;
  doorwaySide: BuildingSpec3D['doorwaySide'];
  width: number;
  height: number;
  depth: number;
  doorPivot?: THREE.Group;
}

export function createHumanoidRig(
  el: SceneElement,
  spec: CharacterSpec
): THREE.Group {
  if (spec.archetype === 'robot') {
    return createRobotRig(el, spec);
  }

  const root = new THREE.Group();
  root.name = `character_${el.id}`;

  const primaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.armorColor || el.colorPrimary),
    roughness: spec.armorStyle === 'heavy-plate' || spec.armorStyle === 'cyber-suit' ? 0.34 : 0.68,
    metalness: spec.armorStyle === 'heavy-plate' || spec.armorStyle === 'cyber-suit' ? 0.62 : 0.12,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.secondaryGearColor || el.colorSecondary),
    roughness: 0.72,
    metalness: 0.2,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: el.kind === 'creature' ? new THREE.Color(el.colorPrimary) : new THREE.Color('#d6a888'),
    roughness: 0.65,
    metalness: 0.04,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.visorColor || el.accentColor),
    emissive: new THREE.Color(spec.visorColor || el.accentColor),
    emissiveIntensity: 1.75,
    roughness: 0.18,
    metalness: 0.35,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.35,
    metalness: 0.8,
  });

  const pelvis = new THREE.Group();
  const basePelvisY = 0.96;
  pelvis.position.set(0, basePelvisY, 0);
  root.add(pelvis);

  const pelvisMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.16, 0.22),
    secondaryMat
  );
  pelvisMesh.castShadow = true;
  pelvisMesh.receiveShadow = true;
  pelvis.add(pelvisMesh);

  // Spine + Torso
  const spine = new THREE.Group();
  spine.position.set(0, 0.08, 0);
  pelvis.add(spine);

  const torsoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.44, 0.24),
    primaryMat
  );
  torsoMesh.position.set(0, 0.24, 0);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  spine.add(torsoMesh);

  // Armored chest plate & shoulder pads
  if (spec.armorStyle !== 'none') {
    const chestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.41, 0.26, 0.28),
      primaryMat
    );
    chestPlate.position.set(0, 0.31, 0.01);
    chestPlate.castShadow = true;
    spine.add(chestPlate);

    const chestCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.06, 0.04),
      visorMat
    );
    chestCore.position.set(0, 0.32, 0.15);
    spine.add(chestCore);
  }

  // Optional Backpack
  if (spec.weaponOrGear === 'backpack' || spec.archetype === 'astronaut') {
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.36, 0.16),
      secondaryMat
    );
    pack.position.set(0, 0.28, -0.18);
    pack.castShadow = true;
    spine.add(pack);
  }

  // Optional Cloak / Trench-Coat
  let cloakMesh: THREE.Mesh | undefined;
  if (spec.cloakOrCoat) {
    const cloakMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.cloakColor || el.colorSecondary),
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    cloakMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.36, 0.92, 8, 1, true, Math.PI * 0.4, Math.PI * 1.2),
      cloakMat
    );
    cloakMesh.position.set(0, -0.02, -0.12);
    cloakMesh.rotation.x = 0.12;
    cloakMesh.castShadow = true;
    spine.add(cloakMesh);
  }

  // Neck + Head
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0);
  spine.add(head);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.075, 0.1, 10),
    skinMat
  );
  neckMesh.position.set(0, 0.03, 0);
  head.add(neckMesh);

  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 16, 14),
    spec.headgear === 'helmet' || spec.headgear === 'visor-helmet'
      ? primaryMat
      : skinMat
  );
  cranium.position.set(0, 0.17, 0);
  cranium.castShadow = true;
  head.add(cranium);

  // Visor / Eyes / Headgear
  if (spec.headgear === 'visor-helmet' || spec.headgear === 'cyber-optics') {
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.075, 0.12),
      visorMat
    );
    visor.position.set(0, 0.17, 0.1);
    head.add(visor);
  } else {
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), visorMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), visorMat);
    eyeL.position.set(-0.048, 0.18, 0.12);
    eyeR.position.set(0.048, 0.18, 0.12);
    head.add(eyeL, eyeR);

    if (spec.headgear === 'hood') {
      const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.155, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65),
        secondaryMat
      );
      hood.position.set(0, 0.18, -0.02);
      hood.rotation.x = -0.35;
      head.add(hood);
    } else if (spec.headgear === 'none') {
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.142, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(spec.hairColor || '#1e293b'),
          roughness: 0.85,
        })
      );
      hair.position.set(0, 0.185, -0.01);
      head.add(hair);
    }
  }

  // Arms helper
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 0.44, 0);
    spine.add(shoulder);

    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      primaryMat
    );
    pauldron.castShadow = true;
    shoulder.add(pauldron);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.046, 0.28, 10),
      secondaryMat
    );
    upperArm.position.set(0, -0.14, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.038, 0.26, 10),
      primaryMat
    );
    forearm.position.set(0, -0.13, 0);
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), skinMat);
    hand.position.set(0, -0.27, 0);
    elbow.add(hand);

    // Held weapon / gear on right hand
    if (side === 1 && spec.weaponOrGear !== 'none') {
      if (spec.weaponOrGear === 'rifle' || spec.weaponOrGear === 'scanner') {
        const rifle = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.09, 0.58),
          darkMetalMat
        );
        body.position.set(0, -0.27, 0.22);
        const barrelTip = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.03, 0.14),
          visorMat
        );
        barrelTip.position.set(0, -0.26, 0.54);
        rifle.add(body, barrelTip);
        elbow.add(rifle);
      } else if (spec.weaponOrGear === 'blade') {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.06, 0.65),
          visorMat
        );
        blade.position.set(0, -0.27, 0.34);
        elbow.add(blade);
      } else if (spec.weaponOrGear === 'umbrella') {
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.85, 8),
          darkMetalMat
        );
        shaft.position.set(0, 0.1, 0.06);
        const canopy = new THREE.Mesh(
          new THREE.ConeGeometry(0.56, 0.24, 12, 1, true),
          primaryMat
        );
        canopy.position.set(0, 0.5, 0.06);
        elbow.add(shaft, canopy);
      }
    }

    return { shoulder, elbow };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Legs helper (thigh 0.44 + shin 0.44 + boot 0.08 = 0.96 -> reaches ground y = 0!)
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, -0.02, 0);
    pelvis.add(hip);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.06, 0.44, 10),
      secondaryMat
    );
    thigh.position.set(0, -0.22, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    hip.add(knee);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.048, 0.42, 10),
      primaryMat
    );
    shin.position.set(0, -0.21, 0);
    shin.castShadow = true;
    knee.add(shin);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.1, 0.23),
      darkMetalMat
    );
    boot.position.set(0, -0.45, 0.045);
    boot.castShadow = true;
    knee.add(boot);

    return { hip, knee };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Scale cleanly to requested 3D height or scalar
  const targetScale = el.size3d ? el.size3d.h / 1.85 : el.scale;
  root.scale.setScalar(Math.max(0.2, targetScale));

  const rig: CharacterJointRig = {
    type: 'character',
    pelvis,
    spine,
    head,
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftElbow: leftArm.elbow,
    rightElbow: rightArm.elbow,
    leftHip: leftLeg.hip,
    rightHip: rightLeg.hip,
    leftKnee: leftLeg.knee,
    rightKnee: rightLeg.knee,
    cloak: cloakMesh,
    basePelvisY,
    pose: spec.pose,
  };
  root.userData.rig = rig;
  return root;
}

export function createRobotRig(
  el: SceneElement,
  spec: CharacterSpec
): THREE.Group {
  const root = new THREE.Group();
  root.name = `robot_${el.id}`;

  const hullMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.armorColor || el.colorPrimary),
    roughness: 0.3,
    metalness: 0.82,
    map: createBrushedMetalTexture(spec.armorColor || el.colorPrimary),
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.secondaryGearColor || el.colorSecondary),
    roughness: 0.45,
    metalness: 0.72,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.visorColor || el.accentColor),
    emissive: new THREE.Color(spec.visorColor || el.accentColor),
    emissiveIntensity: 2.2,
    roughness: 0.15,
    metalness: 0.2,
  });

  // Base robot stands 2.4m before scale / size3d scaling
  const pelvis = new THREE.Group();
  const basePelvisY = 1.18;
  pelvis.position.set(0, basePelvisY, 0);
  root.add(pelvis);

  const waist = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.24, 0.4),
    jointMat
  );
  waist.castShadow = true;
  pelvis.add(waist);

  const spine = new THREE.Group();
  spine.position.set(0, 0.14, 0);
  pelvis.add(spine);

  const chestHull = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.68, 0.56),
    hullMat
  );
  chestHull.position.set(0, 0.38, 0);
  chestHull.castShadow = true;
  chestHull.receiveShadow = true;
  spine.add(chestHull);

  // Glowing Chest Reactor Core
  const reactorRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.032, 10, 24),
    jointMat
  );
  reactorRing.position.set(0, 0.4, 0.29);
  const reactorCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.04, 18),
    coreMat
  );
  reactorCore.rotation.x = Math.PI / 2;
  reactorCore.position.set(0, 0.4, 0.29);
  spine.add(reactorRing, reactorCore);

  // Armored Head Unit
  const head = new THREE.Group();
  head.position.set(0, 0.76, 0);
  spine.add(head);

  const headHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.28, 0.34),
    hullMat
  );
  headHousing.position.set(0, 0.16, 0);
  headHousing.castShadow = true;
  head.add(headHousing);

  const visorSlit = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.065, 0.06),
    coreMat
  );
  visorSlit.position.set(0, 0.17, 0.16);
  head.add(visorSlit);

  // Twin telemetry antennas
  const antL = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.32, 6), jointMat);
  antL.position.set(-0.15, 0.36, -0.06);
  const antR = antL.clone();
  antR.position.x = 0.15;
  head.add(antL, antR);

  // Heavy Mech Arms
  const buildMechArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.58, 0.62, 0);
    spine.add(shoulder);

    const pauldron = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.28, 0.38),
      hullMat
    );
    pauldron.castShadow = true;
    shoulder.add(pauldron);

    const upperArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.42, 0.2),
      jointMat
    );
    upperArm.position.set(0, -0.24, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.46, 0);
    shoulder.add(elbow);

    const gauntlet = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.44, 0.26),
      hullMat
    );
    gauntlet.position.set(0, -0.22, 0.02);
    gauntlet.castShadow = true;
    elbow.add(gauntlet);

    return { shoulder, elbow };
  };

  const leftArm = buildMechArm(-1);
  const rightArm = buildMechArm(1);

  // Heavy Mech Legs (thigh 0.52 + shin 0.52 + foot 0.14 = 1.18 -> ground y=0)
  const buildMechLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.24, -0.06, 0);
    pelvis.add(hip);

    const thigh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.5, 0.28),
      hullMat
    );
    thigh.position.set(0, -0.25, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.5, 0);
    hip.add(knee);

    const shin = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.5, 0.32),
      jointMat
    );
    shin.position.set(0, -0.25, 0);
    shin.castShadow = true;
    knee.add(shin);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.14, 0.52),
      hullMat
    );
    foot.position.set(0, -0.55, 0.08);
    foot.castShadow = true;
    knee.add(foot);

    return { hip, knee };
  };

  const leftLeg = buildMechLeg(-1);
  const rightLeg = buildMechLeg(1);

  const targetScale = el.size3d ? el.size3d.h / 2.4 : el.scale;
  root.scale.setScalar(Math.max(0.3, targetScale));

  const rig: CharacterJointRig = {
    type: 'character',
    pelvis,
    spine,
    head,
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftElbow: leftArm.elbow,
    rightElbow: rightArm.elbow,
    leftHip: leftLeg.hip,
    rightHip: rightLeg.hip,
    leftKnee: leftLeg.knee,
    rightKnee: rightLeg.knee,
    basePelvisY,
    pose: spec.pose,
  };
  root.userData.rig = rig;
  return root;
}

export function animateCharacterRig(
  rig: CharacterJointRig,
  tSec: number,
  isMoving: boolean,
  speedMultiplier = 1
): void {
  const pose = rig.pose;
  const strideActive =
    isMoving ||
    pose === 'walking' ||
    pose === 'running' ||
    pose === 'sprinting' ||
    pose === 'chasing';

  if (strideActive) {
    const isRun = pose === 'running' || pose === 'sprinting' || pose === 'chasing';
    const freq = (isRun ? 9.5 : 5.6) * Math.max(0.5, Math.abs(speedMultiplier));
    const amp = isRun ? 0.82 : 0.5;
    const phase = tSec * freq;

    const swingL = Math.sin(phase) * amp;
    const swingR = -swingL;

    rig.leftHip.rotation.x = swingL;
    rig.rightHip.rotation.x = swingR;

    rig.leftKnee.rotation.x = Math.max(0, -Math.cos(phase)) * (isRun ? 1.05 : 0.65);
    rig.rightKnee.rotation.x = Math.max(0, Math.cos(phase)) * (isRun ? 1.05 : 0.65);

    rig.leftShoulder.rotation.x = -swingL * 0.72;
    rig.rightShoulder.rotation.x = -swingR * 0.72;
    rig.leftElbow.rotation.x = -0.35 - Math.max(0, -swingL) * 0.45;
    rig.rightElbow.rotation.x = -0.35 - Math.max(0, -swingR) * 0.45;

    rig.pelvis.position.y = rig.basePelvisY + Math.abs(Math.sin(phase)) * (isRun ? 0.08 : 0.04);
    rig.spine.rotation.x = isRun ? 0.16 : 0.05;
    rig.spine.rotation.y = Math.sin(phase) * 0.09;
    rig.head.rotation.y = -Math.sin(phase) * 0.04;
    if (rig.cloak) {
      rig.cloak.rotation.x = (isRun ? 0.38 : 0.18) + Math.sin(phase * 2) * 0.05;
    }
  } else {
    // Idle breathing / subtle guard stance
    const breath = Math.sin(tSec * 2.1);
    rig.leftHip.rotation.x = 0.03;
    rig.rightHip.rotation.x = -0.03;
    rig.leftKnee.rotation.x = 0.05;
    rig.rightKnee.rotation.x = 0.05;
    rig.leftShoulder.rotation.x = breath * 0.04;
    rig.rightShoulder.rotation.x =
      pose === 'aiming' || pose === 'combat' ? -1.15 : -breath * 0.04;
    rig.leftElbow.rotation.x = -0.18;
    rig.rightElbow.rotation.x = pose === 'aiming' ? -0.25 : -0.18;
    rig.pelvis.position.y = rig.basePelvisY + breath * 0.015;
    rig.spine.rotation.x = breath * 0.02;
    rig.spine.rotation.y = 0;
    rig.head.rotation.y = Math.sin(tSec * 0.8) * 0.08;
  }
}

export function createBuildingGroup(
  el: SceneElement,
  bSpec: BuildingSpec3D,
  maxAnisotropy = 4
): THREE.Group {
  const root = new THREE.Group();
  root.name = `building_${el.id}`;

  const w = el.size3d?.w ?? (bSpec.hasDoorway ? 8.5 : 5.5 * el.scale);
  const d = el.size3d?.d ?? (bSpec.hasDoorway ? 8.5 : 5.5 * el.scale);
  const h =
    el.size3d?.h ??
    Math.max(4.5, bSpec.floors * (bSpec.hasDoorway ? 3.2 : 3.4));

  const { map, emissiveMap } = createWindowFacadeTexture(
    el.colorPrimary,
    el.accentColor,
    el.id,
    bSpec.style,
    maxAnisotropy
  );

  const wallMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map,
    emissive: new THREE.Color(el.accentColor),
    emissiveMap,
    emissiveIntensity: bSpec.style === 'neon-tower' ? 1.4 : 0.75,
    roughness: bSpec.style === 'modern-glass' ? 0.25 : 0.72,
    metalness: bSpec.style === 'modern-glass' ? 0.65 : 0.15,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(el.colorSecondary || '#1e293b'),
    roughness: 0.45,
    metalness: 0.4,
  });

  if (bSpec.hasDoorway) {
    // True geometric hollow building with open doorway portal!
    const doorW = Math.min(w * 0.68, Math.max(1.4, bSpec.doorwayWidth));
    const doorH = Math.min(h * 0.85, Math.max(2.3, bSpec.doorwayHeight));
    const wallT = 0.42;

    const structureGroup = new THREE.Group();
    root.add(structureGroup);

    // Interior floor
    const floorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.2, d),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 })
    );
    floorMesh.position.set(0, 0.1, 0);
    floorMesh.receiveShadow = true;
    structureGroup.add(floorMesh);

    // Left / Right / Back / Roof outer shell
    const sideWallGeo = new THREE.BoxGeometry(wallT, h, d);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(-w / 2 + wallT / 2, h / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.position.set(w / 2 - wallT / 2, h / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, wallT),
      wallMat
    );
    backWall.position.set(0, h / 2, -d / 2 + wallT / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, 0.45, d + 0.4),
      trimMat
    );
    roof.position.set(0, h + 0.22, 0);
    roof.castShadow = true;
    roof.receiveShadow = true;

    structureGroup.add(leftWall, rightWall, backWall, roof);

    // Front wall split cleanly around doorway aperture (z = +d/2)
    const pierW = Math.max(0.4, (w - doorW) / 2);
    const frontLeftPier = new THREE.Mesh(
      new THREE.BoxGeometry(pierW, h, wallT),
      wallMat
    );
    frontLeftPier.position.set(-w / 2 + pierW / 2, h / 2, d / 2 - wallT / 2);
    frontLeftPier.castShadow = true;

    const frontRightPier = new THREE.Mesh(
      new THREE.BoxGeometry(pierW, h, wallT),
      wallMat
    );
    frontRightPier.position.set(w / 2 - pierW / 2, h / 2, d / 2 - wallT / 2);
    frontRightPier.castShadow = true;

    const lintelH = Math.max(0.4, h - doorH);
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, lintelH, wallT),
      wallMat
    );
    lintel.position.set(0, doorH + lintelH / 2, d / 2 - wallT / 2);
    lintel.castShadow = true;

    structureGroup.add(frontLeftPier, frontRightPier, lintel);

    // Architectural Door Frame + Glowing Threshold + Hinged Door Panel
    const frameMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(el.accentColor),
      roughness: 0.35,
      metalness: 0.6,
    });
    const jambL = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, doorH, wallT + 0.16),
      frameMat
    );
    jambL.position.set(-doorW / 2, doorH / 2, d / 2 - wallT / 2);
    const jambR = jambL.clone();
    jambR.position.x = doorW / 2;
    const headerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.36, 0.22, wallT + 0.18),
      frameMat
    );
    headerFrame.position.set(0, doorH, d / 2 - wallT / 2);
    structureGroup.add(jambL, jambR, headerFrame);

    // Hinged door panel pivoted at left jamb
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-doorW / 2 + 0.08, 0, d / 2 - wallT / 2);
    const doorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(doorW - 0.16, doorH - 0.1, 0.1),
      trimMat
    );
    doorLeaf.position.set((doorW - 0.16) / 2, (doorH - 0.1) / 2, 0);
    doorLeaf.castShadow = true;
    doorPivot.add(doorLeaf);
    doorPivot.rotation.y = bSpec.doorwayOpen ? 1.42 : 0; // Swung inward open ~81 deg
    structureGroup.add(doorPivot);

    // Interior warm lighting
    if (bSpec.interiorLit) {
      const interiorGlowMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(bSpec.interiorColor),
        emissive: new THREE.Color(bSpec.interiorColor),
        emissiveIntensity: 0.7,
        roughness: 0.8,
      });
      const backGlowPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.75, h * 0.7),
        interiorGlowMat
      );
      backGlowPanel.position.set(0, h * 0.45, -d / 2 + wallT + 0.05);
      structureGroup.add(backGlowPanel);

      const innerLight = new THREE.PointLight(
        new THREE.Color(bSpec.interiorColor),
        4.5,
        Math.max(w, d) * 1.8,
        1.5
      );
      innerLight.position.set(0, Math.min(h - 0.6, doorH + 0.4), 0);
      structureGroup.add(innerLight);
    }

    // Rotate according to doorwaySide
    if (bSpec.doorwaySide === 'back') structureGroup.rotation.y = Math.PI;
    else if (bSpec.doorwaySide === 'left') structureGroup.rotation.y = -Math.PI / 2;
    else if (bSpec.doorwaySide === 'right') structureGroup.rotation.y = Math.PI / 2;

    const portalInfo: BuildingDoorwayInfo = {
      hasDoorway: true,
      doorwayWidth: doorW,
      doorwayHeight: doorH,
      doorwaySide: bSpec.doorwaySide,
      width: w,
      height: h,
      depth: d,
      doorPivot,
    };
    root.userData.doorwayInfo = portalInfo;
    return root;
  }

  // Standard Skyscraper / Building Massing
  const mainTower = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    wallMat
  );
  mainTower.position.set(0, h / 2, 0);
  mainTower.castShadow = true;
  mainTower.receiveShadow = true;
  root.add(mainTower);

  // Architectural crown setback
  const crownH = Math.max(1.2, h * 0.14);
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.72, crownH, d * 0.72),
    trimMat
  );
  crown.position.set(0, h + crownH / 2, 0);
  crown.castShadow = true;
  root.add(crown);

  // Rooftop spire / beacon for taller towers
  if (h >= 12) {
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.18, Math.min(6, h * 0.22), 8),
      trimMat
    );
    spire.position.set(0, h + crownH + spire.geometry.parameters.height / 2, 0);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(el.accentColor) })
    );
    beacon.position.set(0, h + crownH + spire.geometry.parameters.height, 0);
    root.add(spire, beacon);
  }

  return root;
}

export function createSkylineCluster(
  el: SceneElement,
  maxAnisotropy = 4
): THREE.Group {
  const root = new THREE.Group();
  root.name = `skyline_${el.id}`;
  const rng = createSeededRng(hashSeed(`skyline:${el.id}`));
  const total = Math.max(4, Math.min(18, el.count * 2));
  const style =
    el.variant === 'ruined'
      ? 'ruined'
      : el.variant === 'cyberpunk' || el.variant === 'neon'
      ? 'neon-tower'
      : 'modern-glass';

  for (let i = 0; i < total; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const laneOffset = 9 + rng() * 14;
    const zPos = -48 + (i / total) * 56 + (rng() - 0.5) * 4;
    const bw = 4.5 + rng() * 4.5;
    const bd = 4.5 + rng() * 4.5;
    const bh = (12 + rng() * 26) * el.scale;

    const fakeEl: SceneElement = {
      ...el,
      id: `${el.id}_b${i}`,
      size3d: { w: bw, h: bh, d: bd },
    };
    const bMesh = createBuildingGroup(
      fakeEl,
      {
        floors: Math.max(3, Math.round(bh / 3.2)),
        style,
        hasDoorway: false,
        doorwaySide: 'front',
        doorwayWidth: 2,
        doorwayHeight: 3,
        doorwayOpen: false,
        interiorLit: false,
        interiorColor: el.accentColor,
      },
      maxAnisotropy
    );
    bMesh.position.set(side * laneOffset, 0, zPos);
    root.add(bMesh);
  }
  return root;
}

export function createVehicleGroup(
  el: SceneElement,
  vSpec: VehicleSpec
): THREE.Group {
  const root = new THREE.Group();
  root.name = `vehicle_${el.id}`;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(el.colorPrimary),
    roughness: 0.22,
    metalness: 0.58,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(el.colorSecondary),
    roughness: 0.45,
    metalness: 0.6,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#0f172a',
    roughness: 0.08,
    metalness: 0.1,
    transmission: 0.35,
    transparent: true,
    opacity: 0.85,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(el.accentColor),
    emissive: new THREE.Color(el.accentColor),
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });

  const wheels: THREE.Object3D[] = [];
  const thrusters: THREE.Mesh[] = [];
  const rotors: THREE.Object3D[] = [];

  if (vSpec.subKind === 'spaceship' || vSpec.subKind === 'ufo') {
    if (vSpec.subKind === 'ufo') {
      const saucer = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 2.2, 0.45, 24),
        bodyMat
      );
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        glassMat
      );
      dome.position.y = 0.2;
      const rimGlow = new THREE.Mesh(
        new THREE.TorusGeometry(2.15, 0.09, 10, 28),
        glowMat
      );
      rimGlow.rotation.x = Math.PI / 2;
      root.add(saucer, dome, rimGlow);
    } else {
      // Sculpted Multi-Part Starfighter / Spaceship (nose points +Z)
      const hull = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.65, 3.6, 12),
        bodyMat
      );
      hull.rotation.x = Math.PI / 2;
      hull.castShadow = true;
      root.add(hull);

      const noseCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 1.35, 12),
        trimMat
      );
      noseCone.rotation.x = Math.PI / 2;
      noseCone.position.z = 2.45;
      root.add(noseCone);

      const cockpit = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 16, 12),
        glassMat
      );
      cockpit.scale.set(0.75, 0.55, 1.55);
      cockpit.position.set(0, 0.36, 0.55);
      root.add(cockpit);

      // Swept Delta Wings
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0.7);
      wingShape.lineTo(2.4, -0.9);
      wingShape.lineTo(2.4, -1.4);
      wingShape.lineTo(0, -1.1);
      wingShape.closePath();

      const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
        depth: 0.08,
        bevelEnabled: true,
        bevelSize: 0.02,
        bevelThickness: 0.02,
      });
      const wingR = new THREE.Mesh(wingGeo, bodyMat);
      wingR.rotation.x = -Math.PI / 2;
      wingR.position.set(0.35, 0, -0.1);
      wingR.castShadow = true;

      const wingL = wingR.clone();
      wingL.scale.x = -1;
      wingL.position.x = -0.35;
      root.add(wingL, wingR);

      // Twin Engine Nacelles & Plasma Thrusters
      for (const side of [-1, 1]) {
        const nacelle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.26, 1.55, 12),
          trimMat
        );
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(side * 0.95, 0.05, -1.25);
        root.add(nacelle);

        const plume = new THREE.Mesh(
          new THREE.ConeGeometry(0.2, 1.3, 12),
          glowMat
        );
        plume.rotation.x = -Math.PI / 2;
        plume.position.set(side * 0.95, 0.05, -2.55);
        thrusters.push(plume);
        root.add(plume);
      }
    }
  } else if (vSpec.subKind === 'hover-bike') {
    // Sleek 2-wheeled Bike / Motorcycle / Bicycle (grounded y=0, front faces +Z)
    const wheelRadius = 0.36;
    const frontZ = 0.78;
    const rearZ = -0.78;

    const addFrameTube = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      radius: number,
      mat: THREE.Material
    ) => {
      const a = new THREE.Vector3(ax, ay, az);
      const b = new THREE.Vector3(bx, by, bz);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = Math.max(0.02, dir.length());
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, len, 10),
        mat
      );
      tube.position.copy(a).addScaledVector(dir, 0.5);
      tube.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize()
      );
      tube.castShadow = true;
      root.add(tube);
    };

    // Main Diamond Frame (crank, seat tube, down tube, top tube, head tube)
    addFrameTube(0, 0.38, -0.1, 0, 0.84, -0.26, 0.036, bodyMat); // seat tube
    addFrameTube(0, 0.38, -0.1, 0, 0.8, 0.48, 0.04, bodyMat); // down tube
    addFrameTube(0, 0.84, -0.26, 0, 0.9, 0.45, 0.036, bodyMat); // top tube
    addFrameTube(0, 0.77, 0.49, 0, 0.96, 0.43, 0.046, trimMat); // head tube

    // Rear stays & front fork blades
    for (const side of [-1, 1]) {
      addFrameTube(side * 0.065, wheelRadius, rearZ, side * 0.04, 0.38, -0.1, 0.022, bodyMat);
      addFrameTube(side * 0.065, wheelRadius, rearZ, side * 0.04, 0.82, -0.25, 0.022, bodyMat);
      addFrameTube(side * 0.085, wheelRadius, frontZ, side * 0.06, 0.8, 0.48, 0.028, trimMat);
    }
    addFrameTube(-0.085, 0.8, 0.48, 0.085, 0.8, 0.48, 0.028, trimMat);

    // Seat post & sculpted saddle
    addFrameTube(0, 0.84, -0.26, 0, 0.96, -0.3, 0.026, trimMat);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.34), trimMat);
    seat.name = 'bike_seat';
    seat.position.set(0, 0.99, -0.32);
    seat.castShadow = true;
    root.add(seat);

    // Handlebar stem, crossbar & grips
    addFrameTube(0, 0.95, 0.43, 0, 1.09, 0.4, 0.028, trimMat);
    const handlebar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.64, 10),
      trimMat
    );
    handlebar.name = 'bike_handlebar';
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.09, 0.4);
    handlebar.castShadow = true;
    root.add(handlebar);
    for (const side of [-1, 1]) {
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10),
        bodyMat
      );
      grip.rotation.z = Math.PI / 2;
      grip.position.set(side * 0.27, 1.09, 0.4);
      root.add(grip);
    }

    // Center crank & pedals
    addFrameTube(-0.12, 0.38, -0.1, 0.12, 0.38, -0.1, 0.024, trimMat);
    const chainring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.03, 14),
      trimMat
    );
    chainring.rotation.z = Math.PI / 2;
    chainring.position.set(0.05, 0.38, -0.1);
    root.add(chainring);

    // Headlight & taillight
    if (vSpec.headlights) {
      const hl = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 10),
        new THREE.MeshStandardMaterial({
          color: '#f8fafc',
          emissive: '#e0f2fe',
          emissiveIntensity: 2.4,
        })
      );
      hl.position.set(0, 0.88, 0.55);
      root.add(hl);
    }
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.06), glowMat);
    tl.position.set(0, 0.84, -0.49);
    root.add(tl);

    if (vSpec.exhaustFlame) {
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 10), glowMat);
      plume.rotation.x = -Math.PI / 2;
      plume.position.set(0, 0.38, -1.16);
      thrusters.push(plume);
      root.add(plume);
    }

    // 2 Rotating Wheels (front & rear): tire stays flush on ground y=0 while spokes & hub spin cleanly
    const tireMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.85,
      metalness: 0.1,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(el.accentColor || '#cbd5e1'),
      roughness: 0.25,
      metalness: 0.88,
    });
    for (const wz of [frontZ, rearZ]) {
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(wheelRadius - 0.05, 0.05, 12, 28),
        tireMat
      );
      tire.rotation.y = Math.PI / 2;
      tire.position.set(0, wheelRadius, wz);
      tire.castShadow = true;
      root.add(tire);

      const wGroup = new THREE.Group();
      wGroup.position.set(0, wheelRadius, wz);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.13, 10),
        rimMat
      );
      hub.rotation.z = Math.PI / 2;

      const spokeSpan = (wheelRadius - 0.12) * 2;
      const spokeA = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, spokeSpan, 0.025),
        rimMat
      );
      const spokeB = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.025, spokeSpan),
        rimMat
      );
      wGroup.add(hub, spokeA, spokeB);
      wheels.push(wGroup);
      root.add(wGroup);
    }
  } else {
    // 3D Racing / Sports / Cyber Car / Truck (grounded y=0, front faces +Z)
    const wheelRadius = vSpec.subKind === 'truck' ? 0.44 : 0.36;
    const wheelWidth = 0.28;
    const carLen = vSpec.subKind === 'truck' ? 5.2 : 4.5;
    const halfLen = carLen / 2;

    // Lower Chassis Tub
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 0.56, carLen),
      bodyMat
    );
    chassis.position.set(0, wheelRadius + 0.26, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    root.add(chassis);

    // Sculpted Cabin Canopy
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.48, carLen * 0.46),
      glassMat
    );
    cabin.position.set(0, wheelRadius + 0.72, -0.2);
    cabin.castShadow = true;
    root.add(cabin);

    // Front Splitter + Rear GT Spoiler Wing
    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(2.04, 0.1, 0.45),
      trimMat
    );
    splitter.position.set(0, wheelRadius + 0.02, halfLen - 0.05);
    root.add(splitter);

    const spoilerPylonL = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.32, 0.28),
      trimMat
    );
    spoilerPylonL.position.set(-0.62, wheelRadius + 0.68, -halfLen + 0.25);
    const spoilerPylonR = spoilerPylonL.clone();
    spoilerPylonR.position.x = 0.62;
    const spoilerWing = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.07, 0.36),
      bodyMat
    );
    spoilerWing.position.set(0, wheelRadius + 0.84, -halfLen + 0.22);
    root.add(spoilerPylonL, spoilerPylonR, spoilerWing);

    // Headlights & Taillights
    if (vSpec.headlights) {
      for (const side of [-1, 1]) {
        const hl = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.12, 0.08),
          new THREE.MeshStandardMaterial({
            color: '#f8fafc',
            emissive: '#e0f2fe',
            emissiveIntensity: 2.5,
          })
        );
        hl.position.set(side * 0.68, wheelRadius + 0.3, halfLen + 0.01);
        root.add(hl);
      }
    }
    for (const side of [-1, 1]) {
      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.1, 0.08),
        new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#ef4444',
          emissiveIntensity: 2.2,
        })
      );
      tl.position.set(side * 0.66, wheelRadius + 0.32, -halfLen - 0.01);
      root.add(tl);
    }

    // Exhaust Flame Plumes
    if (vSpec.exhaustFlame) {
      for (const side of [-0.36, 0.36]) {
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.11, 0.75, 10),
          glowMat
        );
        flame.rotation.x = -Math.PI / 2;
        flame.position.set(side, wheelRadius + 0.14, -halfLen - 0.35);
        thrusters.push(flame);
        root.add(flame);
      }
    }

    // 4 Rotating Wheel + Rim Assemblies
    const tireMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.85,
      metalness: 0.1,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(el.accentColor || '#cbd5e1'),
      roughness: 0.25,
      metalness: 0.88,
    });

    const wheelCoords: Array<[number, number]> = [
      [-0.98, halfLen - 0.85],
      [0.98, halfLen - 0.85],
      [-0.98, -halfLen + 0.85],
      [0.98, -halfLen + 0.85],
    ];
    for (const [wx, wz] of wheelCoords) {
      const wGroup = new THREE.Group();
      wGroup.position.set(wx, wheelRadius, wz);
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20),
        tireMat
      );
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.58, wheelRadius * 0.58, wheelWidth + 0.02, 10),
        rimMat
      );
      rim.rotation.z = Math.PI / 2;

      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(wheelWidth + 0.04, wheelRadius * 1.05, 0.06),
        rimMat
      );
      wGroup.add(tire, rim, spoke);
      wheels.push(wGroup);
      root.add(wGroup);
    }
  }

  root.scale.setScalar(Math.max(0.25, el.scale));
  const rigData: VehicleRigData = {
    type: 'vehicle',
    subKind: vSpec.subKind,
    wheels,
    thrusters,
    rotors,
  };
  root.userData.rig = rigData;
  return root;
}

export function createPlanetGroup(
  el: SceneElement,
  pSpec: PlanetSpec
): THREE.Group {
  const root = new THREE.Group();
  root.name = `planet_${el.id}`;

  const radius = Math.max(1.2, 4.2 * pSpec.radiusScale * el.scale);
  const planetTex = createPlanetTexture(
    pSpec.surfaceStyle,
    el.colorPrimary,
    el.colorSecondary,
    el.accentColor
  );

  const isStar = pSpec.bodyRole === 'star' || pSpec.surfaceStyle === 'sun-corona';
  const bodyMat = isStar
    ? new THREE.MeshBasicMaterial({ map: planetTex, color: new THREE.Color(el.colorPrimary) })
    : new THREE.MeshStandardMaterial({
        map: planetTex,
        roughness: pSpec.surfaceStyle === 'icy' ? 0.35 : 0.78,
        metalness: 0.06,
      });

  const bodyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 40, 28),
    bodyMat
  );
  bodyMesh.castShadow = !isStar;
  bodyMesh.receiveShadow = !isStar;
  root.add(bodyMesh);

  // Subtle atmospheric Fresnel glow halo
  const atmoMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(el.accentColor),
    transparent: true,
    opacity: isStar ? 0.25 : 0.14,
    side: THREE.BackSide,
  });
  const atmoMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.08, 32, 24),
    atmoMat
  );
  root.add(atmoMesh);

  if (pSpec.hasRings) {
    const ringGeo = new THREE.RingGeometry(radius * 1.32, radius * 2.1, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(pSpec.ringColor || el.accentColor),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      roughness: 0.65,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * 0.42;
    ring.rotation.y = 0.22;
    root.add(ring);
  }

  if (isStar) {
    const starLight = new THREE.PointLight(
      new THREE.Color(el.accentColor || '#fde68a'),
      5.5,
      260,
      0.8
    );
    root.add(starLight);
  }

  const rig: PlanetRigData = {
    type: 'planet',
    bodyMesh,
    cloudOrAtmosphere: atmoMesh,
  };
  root.userData.rig = rig;
  root.userData.radius = radius;
  return root;
}

export function createDroneGroup(
  el: SceneElement,
  dSpec: DroneSpec
): THREE.Group {
  const root = new THREE.Group();
  root.name = `drone_${el.id}`;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(el.colorPrimary),
    roughness: 0.35,
    metalness: 0.75,
  });
  const ledMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(dSpec.statusLedColor),
    emissive: new THREE.Color(dSpec.statusLedColor),
    emissiveIntensity: 2.4,
  });
  const rotorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(el.accentColor),
    transparent: true,
    opacity: 0.55,
    roughness: 0.2,
  });

  const core = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.26, 0.95), bodyMat);
  core.castShadow = true;
  root.add(core);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), ledMat);
  eye.position.set(0, -0.02, 0.48);
  root.add(eye);

  const rotors: THREE.Object3D[] = [];
  const count = Math.max(2, Math.min(6, dSpec.rotorCount));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / 4;
    const ax = Math.cos(angle) * 0.95;
    const az = Math.sin(angle) * 0.95;

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.07, 1.05),
      bodyMat
    );
    arm.position.set(ax * 0.5, 0.04, az * 0.5);
    arm.rotation.y = Math.atan2(ax, az);
    root.add(arm);

    const rotorDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.02, 12),
      rotorMat
    );
    rotorDisc.position.set(ax, 0.11, az);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.025, 0.06),
      bodyMat
    );
    rotorDisc.add(blade);
    rotors.push(rotorDisc);
    root.add(rotorDisc);
  }

  let searchlight: THREE.Object3D | undefined;
  if (dSpec.hasSearchlight) {
    const beamCone = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 5.2, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(dSpec.searchlightColor),
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beamCone.position.set(0, -2.65, 0.5);
    beamCone.rotation.x = THREE.MathUtils.degToRad(dSpec.searchlightAngleDeg);
    searchlight = beamCone;
    root.add(beamCone);
  }

  root.scale.setScalar(Math.max(0.4, el.scale));
  const rig: DroneRigData = { type: 'drone', rotors, searchlight };
  root.userData.rig = rig;
  return root;
}

export function createProductShowcaseGroup(
  el: SceneElement,
  pSpec: ProductSpec3D
): THREE.Group {
  const root = new THREE.Group();
  root.name = `product_${el.id}`;

  // Select authentic PBR material finish
  const finishColor = new THREE.Color(el.colorPrimary);
  let heroMat: THREE.Material;
  if (pSpec.materialFinish === 'glass') {
    heroMat = new THREE.MeshPhysicalMaterial({
      color: finishColor,
      roughness: 0.05,
      metalness: 0.05,
      transmission: 0.78,
      ior: 1.52,
      thickness: 0.8,
      clearcoat: 1,
      envMapIntensity: 1.5,
    });
  } else if (pSpec.materialFinish === 'chrome' || pSpec.materialFinish === 'gold') {
    heroMat = new THREE.MeshPhysicalMaterial({
      color: pSpec.materialFinish === 'gold' ? new THREE.Color('#f59e0b') : finishColor,
      roughness: 0.09,
      metalness: 0.98,
      clearcoat: 0.7,
      envMapIntensity: 1.45,
    });
  } else if (pSpec.materialFinish === 'carbon') {
    heroMat = new THREE.MeshPhysicalMaterial({
      map: createCarbonFiberTexture(),
      roughness: 0.28,
      metalness: 0.35,
      clearcoat: 0.9,
      envMapIntensity: 1.25,
    });
  } else if (pSpec.materialFinish === 'matte-ceramic') {
    heroMat = new THREE.MeshPhysicalMaterial({
      color: finishColor,
      roughness: 0.42,
      metalness: 0.08,
      clearcoat: 0.3,
    });
  } else {
    heroMat = new THREE.MeshPhysicalMaterial({
      color: finishColor,
      map: createBrushedMetalTexture(el.colorPrimary),
      roughness: 0.22,
      metalness: 0.9,
      clearcoat: 0.45,
      envMapIntensity: 1.35,
    });
  }

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(el.accentColor),
    roughness: 0.14,
    metalness: 0.88,
    clearcoat: 0.8,
    envMapIntensity: 1.3,
  });

  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: '#e2e8f0',
    roughness: 0.04,
    metalness: 0.05,
    transmission: 0.72,
    ior: 1.5,
    clearcoat: 1,
    transparent: true,
    opacity: 0.7,
    envMapIntensity: 1.6,
  });

  let pedestalHeight = 0;
  if (pSpec.hasPedestal) {
    pedestalHeight = 0.55;
    const lathePts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(2.15, 0),
      new THREE.Vector2(2.05, 0.22),
      new THREE.Vector2(1.75, 0.45),
      new THREE.Vector2(1.65, 0.55),
      new THREE.Vector2(0, 0.55),
    ];
    const ped = new THREE.Mesh(
      new THREE.LatheGeometry(lathePts, 40),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(el.colorSecondary || '#0f172a'),
        roughness: 0.2,
        metalness: 0.65,
        clearcoat: 0.8,
      })
    );
    ped.castShadow = true;
    ped.receiveShadow = true;
    root.add(ped);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.72, 0.03, 10, 48),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(el.accentColor),
        emissive: new THREE.Color(el.accentColor),
        emissiveIntensity: 1.8,
      })
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.48;
    root.add(glowRing);
  }

  const productGroup = new THREE.Group();
  productGroup.position.y = pedestalHeight;
  root.add(productGroup);

  let secondHand: THREE.Object3D | undefined;

  if (pSpec.productType === 'watch') {
    // Luxury Chronograph Watch on upright stand
    const stand = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.14, 12, 32),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55 })
    );
    stand.position.y = 1.05;
    stand.castShadow = true;
    productGroup.add(stand);

    const caseBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 0.26, 36),
      heroMat
    );
    caseBody.rotation.x = Math.PI / 2;
    caseBody.position.set(0, 1.35, 0.12);
    caseBody.castShadow = true;
    productGroup.add(caseBody);

    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.075, 14, 36),
      accentMat
    );
    bezel.position.set(0, 1.35, 0.25);
    productGroup.add(bezel);

    const dial = new THREE.Mesh(
      new THREE.CircleGeometry(0.57, 32),
      new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.3, metalness: 0.4 })
    );
    dial.position.set(0, 1.35, 0.26);
    productGroup.add(dial);

    const handPivot = new THREE.Group();
    handPivot.position.set(0, 1.35, 0.275);
    const handMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.46, 0.015),
      accentMat
    );
    handMesh.position.y = 0.18;
    handPivot.add(handMesh);
    secondHand = handPivot;
    productGroup.add(handPivot);

    const crystal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.62, 0.05, 32),
      crystalMat
    );
    crystal.rotation.x = Math.PI / 2;
    crystal.position.set(0, 1.35, 0.3);
    productGroup.add(crystal);
  } else if (pSpec.productType === 'bottle') {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.68, 0),
      new THREE.Vector2(0.75, 0.25),
      new THREE.Vector2(0.72, 1.45),
      new THREE.Vector2(0.28, 1.85),
      new THREE.Vector2(0.24, 2.2),
      new THREE.Vector2(0, 2.2),
    ];
    const flask = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), heroMat);
    flask.castShadow = true;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.34, 0.55, 28),
      accentMat
    );
    cap.position.y = 2.48;
    cap.castShadow = true;
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.04, 10, 28),
      accentMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 2.15;
    productGroup.add(flask, cap, collar);
  } else if (pSpec.productType === 'headphones') {
    const headband = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.1, 14, 36, Math.PI * 1.15),
      heroMat
    );
    headband.position.y = 1.45;
    headband.rotation.z = -Math.PI * 0.075;
    headband.castShadow = true;
    productGroup.add(headband);

    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.42, 0.28, 28),
        heroMat
      );
      cup.rotation.z = Math.PI / 2;
      cup.position.set(side * 0.92, 1.05, 0);
      cup.castShadow = true;
      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.04, 10, 28),
        accentMat
      );
      trim.rotation.y = Math.PI / 2;
      trim.position.set(side * 1.06, 1.05, 0);
      productGroup.add(cup, trim);
    }
  } else {
    // Precision Reflective Sculpture / Precision Product Body
    const core = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.62, 0.2, 96, 20),
      heroMat
    );
    core.position.y = 1.35;
    core.castShadow = true;
    const outerOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 32, 24),
      crystalMat
    );
    outerOrb.position.y = 1.35;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.045, 12, 42),
      accentMat
    );
    ring.position.y = 1.35;
    ring.rotation.x = 0.7;
    productGroup.add(core, outerOrb, ring);
  }

  root.scale.setScalar(Math.max(0.4, el.scale));
  const rig: ProductRigData = {
    type: 'product',
    productGroup,
    turntableSpin: pSpec.turntableSpin,
    secondHand,
  };
  root.userData.rig = rig;
  return root;
}

export function createMountainRangeGroup(el: SceneElement): THREE.Group {
  const root = new THREE.Group();
  root.name = `mountains_${el.id}`;

  const w = el.size3d?.w ?? 180;
  const d = el.size3d?.d ?? 75;
  const maxH = el.size3d?.h ?? 36 * el.scale;

  const geo = new THREE.PlaneGeometry(w, d, 64, 28);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const lowCol = new THREE.Color(el.colorSecondary || '#1e293b');
  const midCol = new THREE.Color(el.colorPrimary || '#334155');
  const peakCol = new THREE.Color(el.accentColor || '#cbd5e1');
  const tmp = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    // Ridge silhouette rising cleanly toward center z and undulating across x
    const zEnv = Math.max(0, 1 - Math.abs(z) / (d * 0.5));
    const ridge1 = Math.abs(Math.sin(x * 0.055 + 0.7) * Math.cos(z * 0.08));
    const ridge2 = Math.abs(Math.sin(x * 0.13 + z * 0.11)) * 0.45;
    const hVal = Math.pow(zEnv, 0.7) * (ridge1 + ridge2) * maxH;
    posAttr.setY(i, hVal);

    const norm = Math.min(1, hVal / Math.max(1, maxH * 0.95));
    if (norm < 0.55) {
      tmp.copy(lowCol).lerp(midCol, norm / 0.55);
    } else {
      tmp.copy(midCol).lerp(peakCol, (norm - 0.55) / 0.45);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  root.add(mesh);
  return root;
}

export function createForestInstancedGroup(
  el: SceneElement,
  avoidCenterCorridor = false
): THREE.Group {
  const root = new THREE.Group();
  root.name = `forest_${el.id}`;

  const rng = createSeededRng(hashSeed(`forest:${el.id}:${el.count}`));
  const treeCount = Math.min(240, Math.max(18, el.count * 14));
  const spreadX = el.size3d?.w ?? 90;
  const spreadZ = el.size3d?.d ?? 90;

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 2.2, 7);
  trunkGeo.translate(0, 1.1, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(el.colorSecondary || '#451a03'),
    roughness: 0.92,
  });

  const crownLowGeo = new THREE.ConeGeometry(1.55, 3.0, 8);
  crownLowGeo.translate(0, 3.2, 0);
  const crownTopGeo = new THREE.ConeGeometry(1.05, 2.4, 8);
  crownTopGeo.translate(0, 4.9, 0);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(el.colorPrimary || '#15803d'),
    roughness: 0.85,
  });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crownsLow = new THREE.InstancedMesh(crownLowGeo, foliageMat, treeCount);
  const crownsTop = new THREE.InstancedMesh(crownTopGeo, foliageMat, treeCount);
  trunks.castShadow = true;
  crownsLow.castShadow = true;
  crownsLow.receiveShadow = true;
  crownsTop.castShadow = true;

  const dummy = new THREE.Object3D();
  const baseColor = new THREE.Color(el.colorPrimary || '#15803d');
  const tintColor = new THREE.Color();

  for (let i = 0; i < treeCount; i++) {
    let tx = (rng() - 0.5) * spreadX;
    if (avoidCenterCorridor && Math.abs(tx) < 5.2) {
      tx = tx >= 0 ? 5.2 + rng() * 8 : -5.2 - rng() * 8;
    }
    const tz = (rng() - 0.5) * spreadZ;
    const s = (0.78 + rng() * 0.55) * el.scale;

    dummy.position.set(tx, 0, tz);
    dummy.rotation.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.04);
    dummy.scale.set(s * (0.9 + rng() * 0.2), s, s * (0.9 + rng() * 0.2));
    dummy.updateMatrix();

    trunks.setMatrixAt(i, dummy.matrix);
    crownsLow.setMatrixAt(i, dummy.matrix);
    crownsTop.setMatrixAt(i, dummy.matrix);

    const shade = 0.78 + rng() * 0.36;
    tintColor.copy(baseColor).multiplyScalar(shade);
    crownsLow.setColorAt(i, tintColor);
    crownsTop.setColorAt(i, tintColor);
  }

  trunks.instanceMatrix.needsUpdate = true;
  crownsLow.instanceMatrix.needsUpdate = true;
  crownsTop.instanceMatrix.needsUpdate = true;
  if (crownsLow.instanceColor) crownsLow.instanceColor.needsUpdate = true;
  if (crownsTop.instanceColor) crownsTop.instanceColor.needsUpdate = true;

  root.add(trunks, crownsLow, crownsTop);
  root.userData.treeCount = treeCount;
  return root;
}
