// @ts-nocheck
/// <reference path="../../../three-jsx.d.ts" />
import { useEffect, useState, useRef } from 'react';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { getCustomArModelBlob } from '../../../utils/activityArConfig';

interface ModelLoaderProps {
  url: string;
  fileType?: string;
  position?: [number, number, number];
  scale?: number;
  onLoad?: (model: THREE.Group) => void;
}

export function ModelLoader({
  url,
  fileType,
  position = [0, 0, -2],
  scale = 1,
  onLoad,
}: ModelLoaderProps) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setError(false);
    setModel(null);
    const normalizedFileType = String(fileType || '')
      .trim()
      .toLowerCase();
    const lowerUrl = String(url || '').toLowerCase();
    const inferredFileType = lowerUrl.includes('.3ds')
      ? '3ds'
      : (lowerUrl.includes('.gltf') || lowerUrl.includes('.glb'))
        ? (lowerUrl.includes('.glb') ? 'glb' : 'gltf')
        : 'obj';
    const resolvedFileType = normalizedFileType || inferredFileType;
    const isThreeDS = resolvedFileType === '3ds';
    const isGltf = resolvedFileType === 'gltf' || resolvedFileType === 'glb';
    const loader = isGltf ? new GLTFLoader() : (isThreeDS ? new TDSLoader() : new OBJLoader());
    const isDataUrl = lowerUrl.startsWith('data:');

    console.log(
      `ModelLoader: Starting to load model from: ${url} (${resolvedFileType}, attempt ${retryCount + 1})`
    );

    // Extract directory path for textures
    const slashIndex = url.lastIndexOf('/');
    const resourcePath = slashIndex >= 0 ? url.substring(0, slashIndex + 1) : '';
    if (!isDataUrl && !isGltf && 'setResourcePath' in loader) {
      (loader as TDSLoader).setResourcePath(resourcePath);
    }

    const loadModel = async () => {
      let resolvedUrl = url;

      if (url.startsWith('idb://')) {
        const blob = await getCustomArModelBlob(url);
        if (!blob) {
          if (!cancelled) setError(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        resolvedUrl = objectUrl;
      }

      const requestUrl =
        retryCount === 0 || isDataUrl || resolvedUrl.startsWith('blob:')
          ? resolvedUrl
          : `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}retry=${retryCount}`;

      (loader as any).load(
        requestUrl,
        (loaded: any) => {
          if (cancelled) return;
          const object = isGltf ? loaded?.scene : loaded;
          if (!object) {
            setError(true);
            return;
          }
          console.log('ModelLoader: model parsed, processing...');
          console.log('ModelLoader: Children count:', object.children.length);
          
          // Normalize model scale and center
          const box = new THREE.Box3().setFromObject(object);
          const size = box.getSize(new THREE.Vector3());
          console.log('ModelLoader: Bounding box size:', size);
          
          const maxDim = Math.max(size.x, size.y, size.z);
          const normalizedScale = maxDim > 0 ? 1 / maxDim : 1;

          object.scale.setScalar(normalizedScale * scale);

          // Center the model
          const center = box.getCenter(new THREE.Vector3());
          object.position.sub(center.multiplyScalar(normalizedScale * scale));

          // Count meshes
          let meshCount = 0;
          
          // Keep original material appearance when available; only provide a fallback.
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              meshCount++;
              if (!child.material) {
                child.material = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(0xcc9966),
                  roughness: 0.5,
                  metalness: 0.1,
                  side: THREE.DoubleSide,
                });
              } else if (Array.isArray(child.material)) {
                child.material = child.material.map((material) => {
                  if (material instanceof THREE.MeshStandardMaterial) {
                    material.side = THREE.DoubleSide;
                    return material;
                  }
                  const fallback = new THREE.MeshStandardMaterial({
                    color:
                      (material as any)?.color instanceof THREE.Color
                        ? (material as any).color.clone()
                        : new THREE.Color(0xcc9966),
                    map: (material as any)?.map || null,
                    roughness: 0.5,
                    metalness: 0.1,
                    side: THREE.DoubleSide,
                  });
                  return fallback;
                });
              } else if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.side = THREE.DoubleSide;
              } else {
                const baseMaterial: any = child.material;
                child.material = new THREE.MeshStandardMaterial({
                  color:
                    baseMaterial?.color instanceof THREE.Color
                      ? baseMaterial.color.clone()
                      : new THREE.Color(0xcc9966),
                  map: baseMaterial?.map || null,
                  roughness: 0.5,
                  metalness: 0.1,
                  side: THREE.DoubleSide,
                });
              }

              // Shadows are disabled in AR mode to keep paint interaction responsive.
              child.castShadow = false;
              child.receiveShadow = false;
            }
          });
          
          console.log('ModelLoader: Applied material to', meshCount, 'meshes');
          console.log('ModelLoader: Final scale:', object.scale.x);
          console.log('ModelLoader: Model loaded successfully!');

          setModel(object);
          setError(false);
          setRetryCount(0);
          onLoad?.(object);
        },
        (progress) => {
          if (progress.total > 0) {
            console.log(`ModelLoader: Loading ${(progress.loaded / progress.total) * 100}%`);
          }
        },
        (err) => {
          if (cancelled) return;
          console.error(`ModelLoader: Error loading model: ${requestUrl}`, err);
          if (retryCount < MAX_RETRIES) {
            console.warn(`ModelLoader: retrying load (${retryCount + 1}/${MAX_RETRIES})`);
            setRetryCount((prev) => prev + 1);
            return;
          }
          setError(true);
        }
      );
    };

    loadModel();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url, fileType, scale, onLoad, retryCount]);

  // Show fallback placeholder if model failed after retries
  if (error) {
    return (
      <mesh position={position}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial color="#cfa175" roughness={0.65} metalness={0.05} />
      </mesh>
    );
  }

  if (!model) {
    // Loading state - show a small sphere
    return (
      <mesh position={position}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#888888" wireframe />
      </mesh>
    );
  }

  return (
    <primitive object={model} position={position} />
  );
}

/**
 * Fallback placeholder when no model is available
 */
export function PlaceholderModel({
  position = [0, 0, -2],
  onLoad,
}: {
  position?: [number, number, number];
  onLoad?: (model: THREE.Group) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (groupRef.current && onLoad) {
      onLoad(groupRef.current);
    }
  }, [onLoad]);

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#4a90d9" roughness={0.5} metalness={0.2} />
      </mesh>
    </group>
  );
}
