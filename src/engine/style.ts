/**
 * ESTILO VISUAL 3D: sombreado cartoon (3 bandas de luz) y contornos de tinta,
 * como una ilustración. Convierte materiales estándar en toon y agrega un
 * "casco invertido" negro para el contorno de las piezas grandes.
 */
import * as THREE from "three";

let gradient: THREE.DataTexture | null = null;
function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new WeakMap<THREE.Material, THREE.Material>();
const OUTLINE = new THREE.MeshBasicMaterial({ color: "#1a120c", side: THREE.BackSide });

export const quality = { outlines: true };

function toToon(m: THREE.Material): THREE.Material {
  const hit = cache.get(m);
  if (hit) return hit;
  if (!(m instanceof THREE.MeshStandardMaterial) || m.metalness > 0.45 || m.transparent) return m;
  const t = new THREE.MeshToonMaterial({
    color: m.color,
    map: m.map,
    emissive: m.emissive,
    emissiveIntensity: m.emissiveIntensity,
    gradientMap: gradientMap(),
  });
  cache.set(m, t);
  return t;
}

/**
 * Aplica el estilo a un objeto: materiales toon y contorno en piezas de más
 * de `minSize` unidades. Idempotente.
 */
export function stylize(root: THREE.Object3D, minSize = 0.5, outlineWidth = 0.07) {
  const toOutline: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (o as THREE.InstancedMesh).isInstancedMesh || o.userData.outline) return;
    if (o.userData.styled) return;
    if (!Array.isArray(mesh.material)) mesh.material = toToon(mesh.material);
    o.userData.styled = true;
    const g = mesh.geometry;
    g.computeBoundingSphere();
    if ((g.boundingSphere?.radius ?? 0) >= minSize && !(g instanceof THREE.PlaneGeometry) && !(g instanceof THREE.CircleGeometry) && !(g instanceof THREE.RingGeometry))
      toOutline.push(mesh);
  });
  for (const mesh of toOutline) {
    const r = mesh.geometry.boundingSphere!.radius;
    const o = new THREE.Mesh(mesh.geometry, OUTLINE);
    o.userData.outline = true;
    o.name = "outline";
    o.scale.setScalar(1 + outlineWidth / Math.max(0.3, r));
    o.visible = quality.outlines;
    o.castShadow = false;
    o.receiveShadow = false;
    mesh.add(o);
  }
}

export function setOutlines(root: THREE.Object3D, on: boolean) {
  quality.outlines = on;
  root.traverse((o) => {
    if (o.userData.outline) o.visible = on;
  });
}
