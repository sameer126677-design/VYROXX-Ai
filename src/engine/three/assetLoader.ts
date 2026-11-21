import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { AssetRefSpec } from '../../shared/sceneSchema';

export interface ParsedExternalAsset {
  group: THREE.Group;
  animations: THREE.AnimationClip[];
  meshCount: number;
  normalizedHeight: number;
}

/**
 * Normalizes any loaded glTF/GLB model so its bounding box bottom rests at y = 0,
 * centered horizontally at (0, 0), and scaled uniformly to `normalizeHeight` meters.
 */
export function normalizeLoadedGltfGroup(
  gltf: GLTF,
  normalizeHeight = 2.2
): ParsedExternalAsset {
  const wrapper = new THREE.Group();
  wrapper.name = 'external_gltf_root';
  const model = gltf.scene || new THREE.Group();

  let meshCount = 0;
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      meshCount++;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (!box.isEmpty()) {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(0.001, size.y, size.x, size.z);
    const scaleFactor = normalizeHeight / maxDim;

    model.scale.multiplyScalar(scaleFactor);
    model.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    model.position.x -= scaledCenter.x;
    model.position.z -= scaledCenter.z;
    model.position.y -= scaledBox.min.y;
  }

  wrapper.add(model);
  return {
    group: wrapper,
    animations: Array.isArray(gltf.animations) ? gltf.animations : [],
    meshCount,
    normalizedHeight: normalizeHeight,
  };
}

/**
 * Parses raw glTF 2.0 binary (.glb) or UTF-8 JSON (.gltf) ArrayBuffer via Three.js GLTFLoader.
 */
export function parseGlbArrayBuffer(
  buffer: ArrayBuffer,
  options?: { normalizeHeight?: number }
): Promise<ParsedExternalAsset> {
  const loader = new GLTFLoader();
  const targetH = Math.max(0.2, Math.min(100, options?.normalizeHeight ?? 2.2));
  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (gltf) => {
        resolve(normalizeLoadedGltfGroup(gltf, targetH));
      },
      (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    );
  });
}

export function decodeInlineAssetDataUri(dataUri: string): ArrayBuffer {
  const commaIdx = dataUri.indexOf(',');
  if (commaIdx < 0) {
    throw new Error('Malformed inline asset data URI.');
  }
  const meta = dataUri.slice(0, commaIdx).toLowerCase();
  const body = dataUri.slice(commaIdx + 1);
  if (meta.includes(';base64')) {
    const binary =
      typeof atob === 'function'
        ? atob(body)
        : Buffer.from(body, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  const decoded = decodeURIComponent(body);
  return new TextEncoder().encode(decoded).buffer;
}

export interface ExternalAssetRigData {
  type: 'external-asset';
  mixer: THREE.AnimationMixer | null;
  clips: THREE.AnimationClip[];
}

export function attachExternalAssetIntoContainer(
  container: THREE.Group,
  assetRef: AssetRefSpec,
  fetchProtectedAssetBytes?: (storagePath: string) => Promise<ArrayBuffer>
): void {
  const normalizeH = assetRef.normalizeHeight ?? 2.2;

  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(normalizeH * 0.45, normalizeH, normalizeH * 0.45),
    new THREE.MeshBasicMaterial({ color: '#38bdf8', wireframe: true })
  );
  placeholder.position.y = normalizeH / 2;
  placeholder.name = 'external_asset_placeholder';
  container.add(placeholder);

  const hydrateFromBuffer = async (buf: ArrayBuffer) => {
    const parsed = await parseGlbArrayBuffer(buf, { normalizeHeight: normalizeH });
    container.remove(placeholder);
    placeholder.geometry.dispose();
    (placeholder.material as THREE.Material).dispose();
    container.add(parsed.group);

    let mixer: THREE.AnimationMixer | null = null;
    if (parsed.animations.length > 0) {
      mixer = new THREE.AnimationMixer(parsed.group);
      for (const clip of parsed.animations) {
        mixer.clipAction(clip).play();
      }
    }
    const rigData: ExternalAssetRigData = {
      type: 'external-asset',
      mixer,
      clips: parsed.animations,
    };
    container.userData.rig = rigData;
  };

  if (assetRef.inlineDataUri && (assetRef.format === 'glb' || assetRef.format === 'gltf')) {
    try {
      const buf = decodeInlineAssetDataUri(assetRef.inlineDataUri);
      void hydrateFromBuffer(buf).catch(() => {});
    } catch {
      // keep wireframe placeholder safely if malformed URI
    }
    return;
  }

  if (
    assetRef.storagePath &&
    fetchProtectedAssetBytes &&
    (assetRef.format === 'glb' || assetRef.format === 'gltf')
  ) {
    fetchProtectedAssetBytes(assetRef.storagePath)
      .then((buf) => hydrateFromBuffer(buf))
      .catch(() => {
        // leave safe placeholder on network failure
      });
  }
}
