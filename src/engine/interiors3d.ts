/** Interiores 3D de los edificios: aula, sala de audiencias, biblioteca, oficinas. */
import * as THREE from "three";
import { animateIdle, buildAvatar, type AvatarRig } from "./avatarMesh.ts";
import { stylize } from "./style.ts";

export interface Interior {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  npcs: AvatarRig[];
  target: THREE.Vector3;
}

const M = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true, ...o });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y + h / 2, z);
  b.castShadow = true;
  b.receiveShadow = true;
  return b;
}

function textPlane(lines: string[], w: number, h: number, bg: string, fg: string, font = "bold 54px Georgia") {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * h) / w);
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = "center";
  lines.forEach((l, i) => g.fillText(l, c.width / 2, ((i + 1) * c.height) / (lines.length + 1) + 18));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}

function room(scene: THREE.Scene, w: number, d: number, h: number, floor: string, wall: string) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M(floor));
  f.rotation.x = -Math.PI / 2;
  f.receiveShadow = true;
  scene.add(f);
  const wm = M(wall);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wm);
  back.position.set(0, h / 2, -d / 2);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wm);
  left.rotation.y = Math.PI / 2;
  left.position.set(-w / 2, h / 2, 0);
  const right = left.clone();
  right.rotation.y = -Math.PI / 2;
  right.position.x = w / 2;
  for (const p of [back, left, right]) p.receiveShadow = true;
  scene.add(back, left, right);
  // zócalo
  scene.add(box(w, 0.6, 0.1, M("#4a2f1a"), 0, 0, -d / 2 + 0.05));
}

function lights(scene: THREE.Scene, warm = "#ffe2b0") {
  scene.add(new THREE.HemisphereLight("#fff6e8", "#3a2a1a", 0.9));
  const key = new THREE.DirectionalLight(warm, 1.8);
  key.position.set(4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new THREE.PointLight("#9ec3ff", 6, 20);
  fill.position.set(-5, 4, 3);
  scene.add(fill);
}

function npc(scene: THREE.Scene, look: Partial<Parameters<typeof buildAvatar>[0]>, x: number, y: number, z: number, rotY = 0) {
  const rig = buildAvatar({ name: "", skin: "#d9a77c", hair: "#444", suit: "#333", accessory: "ninguno", glasses: false, ...look });
  rig.root.position.set(x, y, z);
  rig.root.rotation.y = rotY;
  scene.add(rig.root);
  return rig;
}

function bench(scene: THREE.Scene, x: number, z: number, w = 3, color = "#7a4f2a") {
  const m = M(color);
  scene.add(box(w, 0.1, 0.5, m, x, 0.45, z), box(w, 0.6, 0.08, m, x, 0.5, z + 0.25), box(0.1, 0.45, 0.45, m, x - w / 2 + 0.1, 0, z), box(0.1, 0.45, 0.45, m, x + w / 2 - 0.1, 0, z));
}

function shelves(scene: THREE.Scene, x: number, z: number, rotY: number, rows = 5) {
  const g = new THREE.Group();
  const wood = M("#5a3a20");
  g.add(box(3, 3.6, 0.5, wood, 0, 0, 0));
  const colors = ["#8c1d1d", "#1f4d7a", "#2f6f55", "#b8861f", "#5a3a7a", "#333"];
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < 9; k++) {
      const hgt = 0.45 + Math.random() * 0.15;
      g.add(box(0.26, hgt, 0.35, M(colors[(r * 3 + k) % colors.length]), -1.2 + k * 0.3, 0.15 + r * 0.7, 0.12));
    }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}

export function buildInterior(id: string): Interior {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const npcs: AvatarRig[] = [];
  let target = new THREE.Vector3(0, 1.6, -3);

  if (id === "facultad") {
    scene.background = new THREE.Color("#2a2018");
    room(scene, 12, 10, 4.5, "#8a6a45", "#e8dcc4");
    const board = textPlane(["Ley 11.683", "Ilícito: típico, antijurídico, culpable", "Clausura: arts. 40-41 · 77-78"], 6, 2.4, "#1f3a2c", "#e8f0e0", "bold 46px Georgia");
    board.position.set(0, 2.4, -4.95);
    scene.add(board, box(6.4, 0.12, 0.25, M("#5a3a20"), 0, 1.1, -4.85));
    scene.add(box(2.4, 0.9, 1, M("#6b4a2b"), 1.8, 0, -3.2));
    npcs.push(npc(scene, { suit: "#5a4632", hair: "#d0d0d0", glasses: true, accessory: "codigo" }, -3.6, 0, -3.2, 0.5));
    for (let r = 0; r < 3; r++) for (const x of [-3, 3]) bench(scene, x, -0.6 + r * 1.6);
    for (const x of [-5.9, 5.9]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2), new THREE.MeshStandardMaterial({ color: "#cfe6ff", emissive: "#9cc8ff", emissiveIntensity: 0.6 }));
      win.position.set(x, 2.4, -1);
      win.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(win);
    }
    lights(scene);
    camera.position.set(0, 2.6, 5.2);
    target = new THREE.Vector3(0, 1.7, -3);
  } else if (id === "tribunal" || id === "audiencias") {
    scene.background = new THREE.Color("#1d1712");
    room(scene, 14, 12, 6, "#5a3a20", "#d9cdb4");
    const wood = M("#4a2f1a");
    scene.add(box(6, 1.25, 1.2, wood, 0, 0, -4.1), box(6.4, 0.12, 1.4, M("#3a2412"), 0, 1.25, -4.1), box(7, 0.6, 3, wood, 0, 0, -4.9));
    const emblem = textPlane(["⚖", "JUSTICIA"], 2.2, 2.2, "#3a2412", "#e3b448", "bold 150px Georgia");
    emblem.position.set(0, 4, -5.95);
    scene.add(emblem);
    npcs.push(npc(scene, { suit: "#111", hair: "#2b2b2b", accessory: "toga" }, 0, 0.6, -5.0, 0));
    scene.add(box(2.6, 0.9, 1, wood, -3, 0, -1.2), box(2.6, 0.9, 1, wood, 3, 0, -1.2));
    npcs.push(npc(scene, { suit: "#2b2f45", hair: "#1d1611" }, 3.6, 0, -1.9, -0.4));
    scene.add(box(12, 1, 0.12, wood, 0, 0, 1.2));
    for (let r = 0; r < 2; r++) for (const x of [-3.5, 3.5]) bench(scene, x, 2.4 + r * 1.5, 4, "#4a2f1a");
    lights(scene, "#ffd9a0");
    camera.position.set(0, 3.4, 6.5);
    target = new THREE.Vector3(0, 2.4, -4.5);
  } else if (id === "biblioteca" || id === "archivo" || id === "investigacion") {
    scene.background = new THREE.Color("#1f160f");
    room(scene, 12, 10, 4.5, "#6b4a2b", id === "investigacion" ? "#dfe8f0" : "#c9b48f");
    for (const x of [-4, 0, 4]) shelves(scene, x, -4.6, 0);
    shelves(scene, -5.7, -1, Math.PI / 2);
    shelves(scene, 5.7, -1, -Math.PI / 2);
    scene.add(box(3, 0.1, 1.4, M("#5a3a20"), 0, 0.8, 0.5), box(0.12, 0.8, 0.12, M("#5a3a20"), -1.3, 0, 0), box(0.12, 0.8, 0.12, M("#5a3a20"), 1.3, 0, 1));
    const lamp = new THREE.PointLight("#ffcf7a", 8, 8);
    lamp.position.set(0, 2, 0.5);
    scene.add(lamp, box(0.3, 0.4, 0.3, M("#e3b448", { emissive: "#e3b448", emissiveIntensity: 0.8 }), 0.8, 0.9, 0.4));
    npcs.push(npc(scene, { suit: id === "investigacion" ? "#f2f2f2" : "#5a2f5a", hair: "#7a4a2a", glasses: true }, -1, 0, -1.6, 0.4));
    lights(scene);
    camera.position.set(0, 2.6, 6);
    target = new THREE.Vector3(0, 1.6, -2);
  } else {
    // Oficinas: estudio jurídico, organismo recaudador, entrenamiento
    const palette: Record<string, [string, string]> = { estudio: ["#3a3f4a", "#e9eef5"], arca: ["#55606e", "#dfe3e8"], entrenamiento: ["#2f4a38", "#e6efe6"] };
    const [floor, wall] = palette[id] ?? ["#4a4a4a", "#e0e0e0"];
    scene.background = new THREE.Color("#141a24");
    room(scene, 12, 10, 4.2, floor, wall);
    const city = textPlane(["", ""], 5, 2.2, "#7fb2e5", "#ffffff");
    city.position.set(0, 2.4, -4.95);
    scene.add(city);
    for (let k = 0; k < 7; k++) scene.add(box(0.5, 0.6 + Math.random() * 1.2, 0.05, M("#5d6b7d"), -2.2 + k * 0.7, 1.3, -4.9));
    scene.add(box(3.2, 0.1, 1.4, M("#2b2f38"), 0, 0.85, -2.2), box(0.1, 0.85, 1.2, M("#2b2f38"), -1.5, 0, -2.2), box(0.1, 0.85, 1.2, M("#2b2f38"), 1.5, 0, -2.2));
    const look =
      id === "estudio" ? { suit: "#8a5a7a", hair: "#7a4a2a", skin: "#e8c39e" } : id === "arca" ? { suit: "#2b3440", hair: "#3b2a1f" } : { suit: "#2f5d50", hair: "#1d1611" };
    npcs.push(npc(scene, look, 0, 0, -3.2, 0));
    const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), M("#3f8a3a"));
    plant.position.set(4.6, 1.2, -3.8);
    scene.add(plant, box(0.6, 0.7, 0.6, M("#8a5a2b"), 4.6, 0, -3.8));
    if (id === "arca") for (let k = 0; k < 4; k++) scene.add(box(0.9, 1.6, 0.7, M("#8f99a6"), -5.2, 0, -3.5 + k * 1.1));
    lights(scene, "#fff2d6");
    camera.position.set(0, 2.4, 5.5);
    target = new THREE.Vector3(0, 1.5, -2.5);
  }
  camera.lookAt(target);
  stylize(scene, 0.4, 0.04);
  return { scene, camera, npcs, target };
}

export function animateInterior(it: Interior, t: number) {
  for (const n of it.npcs) animateIdle(n, t);
  // Cámara con un leve vaivén: da sensación de estar ahí.
  it.camera.position.x = Math.sin(t * 0.25) * 0.6;
  it.camera.lookAt(it.target);
}
