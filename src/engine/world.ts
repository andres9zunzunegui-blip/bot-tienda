/**
 * MOTOR DE JUEGO — mundo isométrico 3D (Three.js).
 * Cámara ortográfica isométrica, ciudad que evoluciona con el progreso,
 * personaje controlable (teclado, clic/toque para caminar), NPCs y misiones visibles.
 */
import * as THREE from "three";
import type { GameState } from "../core/state.ts";
import { effectiveAvatar } from "../content/items.ts";
import { levelFromXp } from "../systems/gamification.ts";
import { chapterDone, missingChapters } from "../modules/reels/progress.ts";
import { animateIdle, animateWalk, buildAvatar, type AvatarRig } from "./avatarMesh.ts";
import { BUILDINGS, constructionSite, type BuildingSpec } from "./buildings.ts";
import { animateInterior, buildInterior, type Interior } from "./interiors3d.ts";
import { setOutlines, stylize } from "./style.ts";

export interface WorldCallbacks {
  onEnter: (id: string) => void;
  onNear: (spec: BuildingSpec | null, unlocked: boolean) => void;
}

const ISO = new THREE.Vector3(1, 1.15, 1).normalize();
const SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize();
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const WORLD_HALF = 34;
/** Textura de adoquines porteños, dibujada en un canvas. */
function adoquines(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#6f6a63";
  g.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 5; col++) {
      const off = row % 2 ? 13 : 0;
      const shade = 140 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgb(${shade},${shade - 6},${shade - 14})`;
      g.beginPath();
      g.roundRect(col * 26 + off - 12, row * 16 + 2, 23, 13, 4);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Puntos de paso de los estudiantes, sobre calles y plaza. */
const WAYPOINTS = [
  [7, 0], [-7, 0], [0, 7], [0, -7], [24, 0], [-24, 0], [0, 26], [0, -14], [14, 0], [-14, 0], [0, 14],
].map(([x, z]) => new THREE.Vector3(x, 0, z));

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function textSprite(text: string, sub = "", color = "#f5d47e") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(13,20,36,0.82)";
  const r = 28;
  g.beginPath();
  g.roundRect(8, 8, 496, sub ? 112 : 80, r);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = color;
  g.font = "bold 40px Inter, system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText(text, 256, 62);
  if (sub) {
    g.fillStyle = "#c8d0e6";
    g.font = "28px Inter, system-ui, sans-serif";
    g.fillText(sub, 256, 102);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(6, 1.5, 1);
  sp.renderOrder = 10;
  return sp;
}

interface BuildingInstance {
  spec: BuildingSpec;
  group: THREE.Group;
  unlocked: boolean;
  label: THREE.Sprite;
  marker?: THREE.Object3D;
  rise: number; // animación de construcción 0..1
}

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private clock = new THREE.Clock();
  private zoom = 1;
  private player!: AvatarRig;
  private playerPos = new THREE.Vector3(0, 0, 6);
  private target: THREE.Vector3 | null = null;
  private enterOnArrive: string | null = null;
  private keys = new Set<string>();
  private buildings = new Map<string, BuildingInstance>();
  private decor = new THREE.Group();
  private npcs: { rig: AvatarRig; base: THREE.Vector3; phase: number }[] = [];
  private walkers: { rig: AvatarRig; target: THREE.Vector3; speed: number; wait: number }[] = [];
  private bus: THREE.Group | null = null;
  private busX = -30;
  private busDir = 1;
  private perf = { frames: 0, time: 0, decided: false };
  private attract = false;
  private interior: Interior | null = null;
  private interiorCache = new Map<string, Interior>();
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private rain: THREE.LineSegments | null = null;
  private rainOn = false;
  private nightFactor = 0;
  private lamps: THREE.PointLight[] = [];
  private attractAngle = 0;
  private ground!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private running = false;
  private paused = false;
  private near: string | null = null;
  private clickMarker: THREE.Mesh;
  private lastState: GameState;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private dragMoved = false;

  constructor(
    private container: HTMLElement,
    state: GameState,
    private cb: WorldCallbacks,
  ) {
    this.lastState = state;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
    this.scene.background = new THREE.Color("#9fc6e8");
    this.scene.fog = new THREE.Fog("#9fc6e8", 80, 160);
    this.playerPos.set(state.playerPos.x, 0, state.playerPos.z);

    this.buildLights();
    this.buildGround();
    this.scene.add(this.decor);
    this.clickMarker = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 24), new THREE.MeshBasicMaterial({ color: "#f5d47e", transparent: true, opacity: 0 }));
    this.clickMarker.rotation.x = -Math.PI / 2;
    this.clickMarker.position.y = 0.05;
    this.scene.add(this.clickMarker);
    this.rebuildPlayer(state);
    this.buildNPCs();
    this.buildWalkers();
    this.buildBus();
    this.buildKiosk();
    this.buildLamps();
    this.buildGardens();
    this.refresh(state, true);
    stylize(this.scene);
    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  /* ------------------------------ Escena ------------------------------ */

  private buildLights() {
    this.hemi = new THREE.HemisphereLight("#dfefff", "#4b6b3a", 1.1);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight("#fff2d6", 2.2);
    this.sun = sun;
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera as THREE.OrthographicCamera;
    s.left = -45;
    s.right = 45;
    s.top = 45;
    s.bottom = -45;
    s.far = 150;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  private buildGround() {
    const grass = new THREE.MeshStandardMaterial({ color: "#6fa354", roughness: 1 });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2 + 20, WORLD_HALF * 2 + 20), grass);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    const road = new THREE.MeshStandardMaterial({ map: adoquines(), roughness: 0.95 });
    const strip = (x: number, z: number, w: number, d: number) => {
      const geo = new THREE.PlaneGeometry(w, d);
      const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 3, (uv.getY(i) * d) / 3);
      const m = new THREE.Mesh(geo, road);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.02, z);
      m.receiveShadow = true;
      this.scene.add(m);
    };
    strip(0, 0, WORLD_HALF * 2, 3.2);
    strip(0, 29.5, WORLD_HALF * 2, 4); // avenida por la que pasa el colectivo
    strip(0, 0, 3.2, WORLD_HALF * 2);
    for (const b of BUILDINGS) {
      const dz = b.z + b.d / 2 + 1.5;
      strip(b.x, (dz + 0) / 2, 2, Math.abs(dz));
    }
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshStandardMaterial({ color: "#d8d0bd", roughness: 0.9 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.03;
    plaza.receiveShadow = true;
    this.scene.add(plaza);
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6, 40), new THREE.MeshStandardMaterial({ color: "#b8ad94" }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    this.scene.add(ring);
    // Borde de la ciudad: arbustos
    const hedge = new THREE.MeshStandardMaterial({ color: "#4f7f3c", flatShading: true });
    for (let i = -WORLD_HALF; i <= WORLD_HALF; i += 3)
      for (const [x, z] of [
        [i, -WORLD_HALF],
        [i, WORLD_HALF],
        [-WORLD_HALF, i],
        [WORLD_HALF, i],
      ]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2.6), hedge);
        m.position.set(x, 0.55, z);
        m.castShadow = true;
        this.scene.add(m);
      }
  }

  /** Árbol: tilo verde o jacarandá en flor (el violeta de Buenos Aires en noviembre). */
  private tree(x: number, z: number, s = 1, jacaranda = false) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 1.2 * s, 6), new THREE.MeshStandardMaterial({ color: "#6b4a2b", flatShading: true }));
    trunk.position.y = 0.6 * s;
    const leaf = new THREE.MeshStandardMaterial({ color: jacaranda ? "#9b6fd6" : "#3f8a3a", flatShading: true });
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1 * s, 0), leaf);
    top.position.y = 1.8 * s;
    g.add(trunk, top);
    if (jacaranda) {
      const top2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 * s, 0), new THREE.MeshStandardMaterial({ color: "#b48be8", flatShading: true }));
      top2.position.set(0.5 * s, 2.3 * s, 0.2 * s);
      g.add(top2);
      // Flores caídas en el pasto
      const petals = new THREE.Mesh(new THREE.CircleGeometry(1.5 * s, 12), new THREE.MeshStandardMaterial({ color: "#a982df", roughness: 1 }));
      petals.rotation.x = -Math.PI / 2;
      petals.position.y = 0.02;
      petals.receiveShadow = true;
      g.add(petals);
    }
    g.position.set(x, 0, z);
    g.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o.castShadow = true), (o.receiveShadow = true)) : null));
    return g;
  }

  /** Estudiantes que caminan por la ciudad: le dan vida al mundo. */
  private buildWalkers() {
    const looks = [
      { suit: "#7a3b2e", hair: "#2b1d14", skin: "#e8c39e" },
      { suit: "#2f5d50", hair: "#c9a15a", skin: "#f1d0b5" },
      { suit: "#4a4f8a", hair: "#1d1611", skin: "#9a6a43" },
      { suit: "#8a6d2e", hair: "#6b1f1f", skin: "#c68e62" },
      { suit: "#3a3a3a", hair: "#9a9a9a", skin: "#e0b48a" },
      { suit: "#5a2f5a", hair: "#3b2a1f", skin: "#d9a77c" },
    ];
    for (const [k, l] of looks.entries()) {
      const rig = buildAvatar({ name: "", accessory: k % 2 ? "codigo" : "ninguno", glasses: k % 3 === 0, ...l });
      rig.root.scale.setScalar(0.92);
      const p = WAYPOINTS[k % WAYPOINTS.length];
      rig.root.position.set(p.x, 0, p.z);
      this.scene.add(rig.root);
      this.walkers.push({ rig, target: WAYPOINTS[(k + 3) % WAYPOINTS.length].clone(), speed: 1.6 + Math.random() * 0.8, wait: Math.random() * 3 });
    }
  }

  /** Canteros con flores y variaciones de césped. */
  private buildGardens() {
    const r = rng(42);
    const patchGeo = new THREE.CircleGeometry(1, 10);
    const patchMat = new THREE.MeshStandardMaterial({ color: "#5f9448", roughness: 1 });
    const patches = new THREE.InstancedMesh(patchGeo, patchMat, 90);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    for (let i = 0; i < 90; i++) {
      const s = 1 + r() * 2.5;
      m.compose(new THREE.Vector3((r() * 2 - 1) * (WORLD_HALF - 2), 0.01, (r() * 2 - 1) * (WORLD_HALF - 2)), q, new THREE.Vector3(s, s * (0.6 + r() * 0.6), 1));
      patches.setMatrixAt(i, m);
    }
    patches.receiveShadow = true;
    this.scene.add(patches);
    const colors = ["#f5d47e", "#ef7b8f", "#ffffff", "#b38cf0", "#ff9f5a"];
    const flowerGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }), 240);
    const bedMat = new THREE.MeshStandardMaterial({ color: "#6b4a2b", roughness: 1 });
    let fi = 0;
    for (const b of BUILDINGS) {
      for (const side of [-1, 1]) {
        const x = b.x + side * (b.w / 2 - 0.9);
        const z = b.z + b.d / 2 + 1.2;
        const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 1.1), bedMat);
        bed.position.set(x, 0.12, z);
        bed.receiveShadow = true;
        this.scene.add(bed);
        for (let k = 0; k < 12 && fi < 240; k++, fi++) {
          m.makeTranslation(x + (r() - 0.5) * 1.5, 0.32 + r() * 0.1, z + (r() - 0.5) * 0.8);
          flowers.setMatrixAt(fi, m);
          flowers.setColorAt(fi, new THREE.Color(colors[Math.floor(r() * colors.length)]));
        }
      }
    }
    flowers.count = fi;
    flowers.castShadow = true;
    this.scene.add(flowers);
  }

  /**
   * Ambiente: hora del día (0-24) y lluvia. Interpola cielo, sol y luz ambiente,
   * enciende ventanas y faroles de noche y muestra gotas cuando llueve.
   */
  setEnvironment(hour: number, rain: boolean) {
    const keys: [number, string, string, number, number][] = [
      // hora, cielo, color del sol, intensidad del sol, intensidad ambiente
      [0, "#0d1630", "#8aa2ff", 0.25, 0.35],
      [5.5, "#1c2448", "#9aa8ff", 0.3, 0.45],
      [7, "#f0b48c", "#ffc79a", 1.3, 0.8],
      [9, "#9fc6e8", "#fff2d6", 2.2, 1.1],
      [17, "#9fc6e8", "#fff2d6", 2.2, 1.1],
      [19, "#e98b6b", "#ffab73", 1.2, 0.75],
      [20.5, "#2a2550", "#9a8cff", 0.4, 0.45],
      [24, "#0d1630", "#8aa2ff", 0.25, 0.35],
    ];
    let a = keys[0];
    let b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++)
      if (hour >= keys[i][0] && hour <= keys[i + 1][0]) {
        a = keys[i];
        b = keys[i + 1];
        break;
      }
    const t = (hour - a[0]) / Math.max(0.001, b[0] - a[0]);
    const sky = new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t);
    const sunCol = new THREE.Color(a[2]).lerp(new THREE.Color(b[2]), t);
    let sunI = a[3] + (b[3] - a[3]) * t;
    let hemiI = a[4] + (b[4] - a[4]) * t;
    if (rain) {
      sky.lerp(new THREE.Color("#5d6b7d"), 0.55);
      sunI *= 0.45;
      hemiI *= 0.8;
    }
    (this.scene.background as THREE.Color).copy(sky);
    (this.scene.fog as THREE.Fog).color.copy(sky);
    this.sun.color.copy(sunCol);
    this.sun.intensity = sunI;
    this.hemi.intensity = hemiI;
    const ang = ((hour - 6) / 12) * Math.PI; // el sol recorre el cielo de 6 a 18
    this.sun.position.set(Math.cos(ang) * 40, Math.max(12, Math.sin(ang) * 55), 25);
    this.nightFactor = Math.max(0, Math.min(1, (0.9 - sunI) / 0.6));
    for (const inst of this.buildings.values())
      inst.group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.emissive && m.emissive.getHex() !== 0) m.emissiveIntensity = 0.35 + this.nightFactor * 1.4;
      });
    for (const l of this.lamps) l.intensity = this.nightFactor * 14;
    this.setRain(rain);
  }

  private setRain(on: boolean) {
    this.rainOn = on;
    if (on && !this.rain) {
      const n = 1400;
      const pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const x = (Math.random() * 2 - 1) * 40;
        const y = Math.random() * 30;
        const z = (Math.random() * 2 - 1) * 40;
        pos.set([x, y, z, x + 0.15, y - 0.9, z + 0.15], i * 6);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: "#cfe0ff", transparent: true, opacity: 0.45 }));
      this.scene.add(this.rain);
    }
    if (this.rain) this.rain.visible = on;
  }

  /** Faroles con luz real alrededor de la plaza (se encienden de noche). */
  private buildLamps() {
    const metal = new THREE.MeshStandardMaterial({ color: "#2b2f38", metalness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: "#ffe9a8", emissive: "#ffd66b", emissiveIntensity: 1 });
    for (const [x, z] of [[6.8, 2.6], [-6.8, 2.6], [6.8, -2.6], [-6.8, -2.6]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.4, 6), metal);
      p.position.set(x, 1.7, z);
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), glass);
      g.position.set(x, 3.5, z);
      const light = new THREE.PointLight("#ffcf7a", 0, 14, 1.6);
      light.position.set(x, 3.3, z);
      this.lamps.push(light);
      this.scene.add(p, g, light);
    }
  }

  /** Colectivo fileteado que recorre la avenida. */
  private buildBus() {
    const g = new THREE.Group();
    const M = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.2, 2.3), M("#1f5fa8"));
    body.position.y = 1.5;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 2.3), M("#f4ead2"));
    roof.position.y = 2.7;
    const win = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.8, 2.34), new THREE.MeshStandardMaterial({ color: "#1b2433", emissive: "#ffd98a", emissiveIntensity: 0.15 }));
    win.position.set(-0.3, 1.95, 0);
    const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(6.42, 0.18, 2.34), M("#b3282d"));
    stripe1.position.y = 1.1;
    const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(6.42, 0.1, 2.34), M("#e8b23a"));
    stripe2.position.y = 0.9;
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 2), new THREE.MeshStandardMaterial({ color: "#cfe6ff", emissive: "#9cc8ff", emissiveIntensity: 0.2 }));
    front.position.set(3.22, 1.9, 0);
    g.add(body, roof, win, stripe1, stripe2, front);
    for (const x of [-2.2, 2.2])
      for (const z of [-1.1, 1.1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), M("#1a1a1a"));
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.45, z);
        g.add(w);
      }
    const sign = textSprite("60 · Facultad", "", "#e8b23a");
    sign.scale.set(3.6, 0.9, 1);
    sign.position.set(0, 3.5, 0);
    g.add(sign);
    g.position.set(this.busX, 0, 29.5);
    g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    this.bus = g;
    this.scene.add(g);
  }

  /** Kiosco de diarios con toldo a rayas, junto a la plaza. */
  private buildKiosk() {
    const g = new THREE.Group();
    const M = (c: string) => new THREE.MeshStandardMaterial({ color: c, flatShading: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 1.6), M("#2f8f6b"));
    base.position.y = 0.9;
    g.add(base);
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 2.2), M(k % 2 ? "#f4ead2" : "#b3282d"));
      s.position.set(-0.88 + k * 0.44, 2.05, 0.2);
      s.rotation.x = 0.25;
      g.add(s);
    }
    const lbl = textSprite("KIOSCO", "", "#e8b23a");
    lbl.scale.set(2.6, 0.65, 1);
    lbl.position.y = 2.9;
    g.add(lbl);
    g.position.set(-6.8, 0, 9.5);
    g.rotation.y = 0.5;
    g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    this.scene.add(g);
  }

  /** Calidad adaptativa: si el equipo no llega a ~35 cuadros por segundo, se aliviana. */
  private adaptQuality(dt: number) {
    if (this.perf.decided) return;
    this.perf.frames++;
    if (this.perf.frames < 30) return; // ignora el arranque
    this.perf.time += dt;
    if (this.perf.frames < 150) return;
    this.perf.decided = true;
    const fps = 120 / this.perf.time;
    if (fps < 35) this.setLowQuality(true);
  }

  setLowQuality(low: boolean) {
    this.renderer.setPixelRatio(low ? 1 : Math.min(2, window.devicePixelRatio));
    this.sun.castShadow = !low;
    for (const l of this.lamps) l.visible = !low;
    setOutlines(this.scene, !low);
    this.resize();
  }

  /** Modo portada: la cámara gira lentamente alrededor de la plaza. */
  setAttract(on: boolean) {
    this.attract = on;
  }

  private buildNPCs() {
    const npc = (x: number, z: number, look: Partial<Parameters<typeof buildAvatar>[0]>, title: string) => {
      const rig = buildAvatar({ name: title, skin: "#d9a77c", hair: "#555", suit: "#333", accessory: "ninguno", glasses: false, ...look });
      rig.root.position.set(x, 0, z);
      rig.root.rotation.y = Math.atan2(-x, 6 - z) * 0.3;
      const lbl = textSprite(title, "", "#c8d0e6");
      lbl.scale.set(3.6, 0.9, 1);
      lbl.position.y = 3;
      rig.root.add(lbl);
      this.scene.add(rig.root);
      this.npcs.push({ rig, base: new THREE.Vector3(x, 0, z), phase: Math.random() * 6 });
    };
    npc(-6.2, -4.4, { suit: "#5a4632", hair: "#d0d0d0", glasses: true, accessory: "codigo" }, "Prof. Ibarra");
    npc(6.2, -4.4, { suit: "#111", hair: "#2b2b2b", accessory: "toga" }, "Jueza Salvatierra");
    npc(15.5, 11.2, { suit: "#8a5a7a", hair: "#7a4a2a", skin: "#e8c39e" }, "Marta (clienta)");
  }

  /** Sincroniza la ciudad con el estado: desbloqueos, decoraciones, marcadores, avatar. */
  refresh(state: GameState, initial = false) {
    const prev = this.lastState;
    this.lastState = state;
    for (const spec of BUILDINGS) {
      const unlocked = state.unlocked.includes(spec.id);
      const inst = this.buildings.get(spec.id);
      if (inst && inst.unlocked === unlocked) continue;
      if (inst) {
        this.scene.remove(inst.group);
        this.scene.remove(inst.label);
      }
      const group = unlocked ? spec.build() : constructionSite(spec);
      group.position.set(spec.x, 0, spec.z);
      group.userData.building = spec.id;
      group.traverse((o) => {
        o.userData.building = spec.id;
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const label = textSprite(`${spec.icon} ${spec.name}`, unlocked ? "" : "🔒 En construcción");
      label.position.set(spec.x, unlocked ? 10.5 : 8, spec.z);
      stylize(group);
      this.scene.add(group, label);
      this.buildings.set(spec.id, { spec, group, unlocked, label, rise: initial || !unlocked ? 1 : 0 });
    }
    // Decoraciones compradas y evolución por nivel
    if (initial || prev.decorations.join() !== state.decorations.join() || levelFromXp(prev.xp) !== levelFromXp(state.xp)) this.buildDecor(state);
    if (initial || prev.equipped.join() !== state.equipped.join() || JSON.stringify(prev.avatar) !== JSON.stringify(state.avatar)) this.rebuildPlayer(state);
    this.updateMarkers(state);
  }

  private buildDecor(state: GameState) {
    this.decor.clear();
    const level = levelFromXp(state.xp);
    const r = rng(7);
    const treeCount = 14 + Math.min(30, level * 3) + (state.decorations.includes("arboleda") ? 20 : 0);
    let placed = 0;
    let tries = 0;
    while (placed < treeCount && tries++ < 800) {
      const x = (r() * 2 - 1) * (WORLD_HALF - 3);
      const z = (r() * 2 - 1) * (WORLD_HALF - 3);
      if (Math.abs(x) < 3 || Math.abs(z) < 3 || Math.hypot(x, z) < 8) continue;
      if (BUILDINGS.some((b) => Math.abs(x - b.x) < b.w / 2 + 2.5 && z > b.z - b.d / 2 - 2.5 && z < b.z + b.d / 2 + 4)) continue;
      this.decor.add(this.tree(x, z, 0.8 + r() * 0.6, r() < 0.42));
      placed++;
    }
    const stone = new THREE.MeshStandardMaterial({ color: "#cfc7b4", flatShading: true });
    if (state.decorations.includes("fuente")) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.6, 20), stone);
      base.position.y = 0.3;
      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.1, 20), new THREE.MeshStandardMaterial({ color: "#5bb4e6", roughness: 0.1, metalness: 0.3 }));
      water.position.y = 0.62;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.8, 10), stone);
      col.position.y = 1.2;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.4, 0.4, 14), stone);
      bowl.position.y = 2.2;
      const g = new THREE.Group();
      g.add(base, water, col, bowl);
      g.name = "fuente";
      this.decor.add(g);
    }
    if (state.decorations.includes("temis")) {
      const g = new THREE.Group();
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), stone);
      ped.position.y = 0.7;
      const gold = new THREE.MeshStandardMaterial({ color: "#e3b448", metalness: 0.7, roughness: 0.3 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 1.8, 8), gold);
      body.position.y = 2.3;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), gold);
      head.position.y = 3.4;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), gold);
      beam.position.y = 3.2;
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 10), gold);
      p1.position.set(-0.8, 2.8, 0);
      const p2 = p1.clone();
      p2.position.x = 0.8;
      g.add(ped, body, head, beam, p1, p2);
      g.position.set(state.decorations.includes("fuente") ? 0 : 0, 0, state.decorations.includes("fuente") ? -4.2 : 0);
      this.decor.add(g);
    }
    if (state.decorations.includes("bancos")) {
      const wood = new THREE.MeshStandardMaterial({ color: "#8a5a2b", flatShading: true });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.6), wood);
        b.position.set(Math.cos(a) * 5, 0.25, Math.sin(a) * 5);
        b.rotation.y = -a + Math.PI / 2;
        this.decor.add(b);
      }
    }
    if (state.decorations.includes("farolas")) {
      const metal = new THREE.MeshStandardMaterial({ color: "#2b2f38", metalness: 0.5 });
      const light = new THREE.MeshStandardMaterial({ color: "#ffe9a8", emissive: "#ffd66b", emissiveIntensity: 1.2 });
      for (let x = -28; x <= 28; x += 8) {
        if (Math.abs(x) < 4) continue;
        for (const z of [-2.4, 2.4]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6), metal);
          p.position.set(x, 1.6, z);
          const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), light);
          l.position.set(x, 3.3, z);
          this.decor.add(p, l);
        }
      }
    }
    this.decor.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o.castShadow = true), (o.receiveShadow = true)) : null));
    stylize(this.decor);
  }

  private updateMarkers(state: GameState) {
    const pending: Record<string, boolean> = {
      tribunal: missingChapters(state, "sim:clausura").length === 0 && !state.log.some((l) => l.kind === "simulacion" && l.quality >= 0.6),
      facultad: missingChapters(state, "sim:clausura").length > 0 || !chapterDone(state, "cap1") || !state.log.some((l) => l.kind === "oral" && l.quality >= 0.6) || state.cards.some((c) => c.due <= Date.now()),
      biblioteca: state.unlocked.includes("biblioteca") && state.materials.some((m) => m.processed === "no"),
      estudio: state.unlocked.includes("estudio"),
    };
    for (const inst of this.buildings.values()) {
      const want = inst.unlocked && pending[inst.spec.id];
      if (want && !inst.marker) {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: "#f5d47e", emissive: "#e3b448", emissiveIntensity: 0.8 }));
        m.position.set(inst.spec.x, 12.3, inst.spec.z);
        this.scene.add(m);
        inst.marker = m;
      } else if (!want && inst.marker) {
        this.scene.remove(inst.marker);
        inst.marker = undefined;
      }
    }
  }

  private rebuildPlayer(state: GameState) {
    const rot = this.player?.root.rotation.y ?? 0;
    if (this.player) this.scene.remove(this.player.root);
    this.player = buildAvatar(effectiveAvatar(state));
    this.player.root.rotation.y = rot;
    this.scene.add(this.player.root);
  }

  /* ------------------------------ Entrada ------------------------------ */

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.paused || (e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      this.keys.add(k);
      this.target = null;
      this.enterOnArrive = null;
      e.preventDefault();
    }
    if ((k === "e" || k === "enter") && this.near) this.enter(this.near);
    if (k === "+" || k === "=") this.setZoom(this.zoom * 1.15);
    if (k === "-") this.setZoom(this.zoom / 1.15);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", () => this.keys.clear());
    const el = this.renderer.domElement;
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 0.9));
    }, { passive: false });
    el.addEventListener("pointerdown", (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragMoved = false;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    el.addEventListener("pointermove", (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) this.dragMoved = true;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist) this.setZoom(this.zoom * (d / this.pinchDist));
        this.pinchDist = d;
      }
    });
    const up = (e: PointerEvent) => {
      const wasPinch = this.pointers.size > 1;
      this.pointers.delete(e.pointerId);
      if (!wasPinch && !this.dragMoved && !this.paused) this.tap(e.clientX, e.clientY);
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", (e) => this.pointers.delete(e.pointerId));
  }

  private tap(cx: number, cy: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const objs = [...this.buildings.values()].map((b) => b.group);
    const hit = this.raycaster.intersectObjects(objs, true)[0];
    let ho: THREE.Object3D | null = hit?.object ?? null;
    while (ho && !ho.userData.building) ho = ho.parent;
    if (ho?.userData.building) {
      const spec = this.buildings.get(ho.userData.building)!.spec;
      this.walkTo(this.doorOf(spec), spec.id);
      return;
    }
    const g = this.raycaster.intersectObject(this.ground)[0];
    if (g) this.walkTo(g.point.clone().setY(0), null);
  }

  private walkTo(p: THREE.Vector3, enter: string | null) {
    this.target = p;
    this.enterOnArrive = enter;
    this.clickMarker.position.set(p.x, 0.05, p.z);
    (this.clickMarker.material as THREE.MeshBasicMaterial).opacity = 1;
  }

  private doorOf(spec: BuildingSpec) {
    return new THREE.Vector3(spec.x, 0, spec.z + spec.d / 2 + 1.4);
  }

  private enter(id: string) {
    this.keys.clear();
    this.target = null;
    this.enterOnArrive = null;
    this.cb.onEnter(id);
  }

  setZoom(z: number) {
    this.zoom = Math.max(0.55, Math.min(2.2, z));
    this.resize();
  }

  /* ------------------------------ Bucle ------------------------------ */

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    const view = (w < 700 ? 34 : 30) / this.zoom;
    const aspect = w / h;
    this.camera.left = (-view * aspect) / 2;
    this.camera.right = (view * aspect) / 2;
    this.camera.top = view / 2;
    this.camera.bottom = -view / 2;
    this.camera.updateProjectionMatrix();
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(this.tick);
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) {
      this.keys.clear();
      this.target = null;
    }
  }

  getPlayerPos() {
    return { x: this.playerPos.x, z: this.playerPos.z };
  }

  private collides(x: number, z: number): boolean {
    for (const b of BUILDINGS) if (Math.abs(x - b.x) < b.w / 2 + 0.4 && Math.abs(z - b.z) < b.d / 2 + 0.4) return true;
    for (const n of this.npcs) if (Math.hypot(x - n.base.x, z - n.base.z) < 0.7) return true;
    return Math.abs(x) > WORLD_HALF - 2 || Math.abs(z) > WORLD_HALF - 2;
  }

  /** Entra a la vista interior 3D de un edificio. */
  showInterior(id: string) {
    let it = this.interiorCache.get(id);
    if (!it) {
      it = buildInterior(id);
      this.interiorCache.set(id, it);
    }
    this.interior = it;
  }

  hideInterior() {
    this.interior = null;
  }

  private tick = () => {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    if (this.interior) {
      const r = this.renderer.domElement;
      this.interior.camera.aspect = r.clientWidth / Math.max(1, r.clientHeight);
      this.interior.camera.updateProjectionMatrix();
      animateInterior(this.interior, t);
      this.renderer.render(this.interior.scene, this.interior.camera);
      return;
    }
    const dir = new THREE.Vector3();
    if (!this.paused) {
      if (this.keys.has("w") || this.keys.has("arrowup")) dir.add(SCREEN_UP);
      if (this.keys.has("s") || this.keys.has("arrowdown")) dir.sub(SCREEN_UP);
      if (this.keys.has("d") || this.keys.has("arrowright")) dir.add(SCREEN_RIGHT);
      if (this.keys.has("a") || this.keys.has("arrowleft")) dir.sub(SCREEN_RIGHT);
      if (!dir.lengthSq() && this.target) {
        const to = this.target.clone().sub(this.playerPos).setY(0);
        if (to.length() < (this.enterOnArrive ? 1.6 : 0.25)) {
          this.target = null;
          const enter = this.enterOnArrive;
          this.enterOnArrive = null;
          if (enter) this.enter(enter);
        } else dir.copy(to);
      }
    }
    const speed = 7.5;
    let moving = false;
    if (dir.lengthSq() > 0) {
      dir.normalize();
      const step = dir.clone().multiplyScalar(speed * dt);
      const nx = this.playerPos.x + step.x;
      const nz = this.playerPos.z + step.z;
      if (!this.collides(nx, nz)) {
        this.playerPos.x = nx;
        this.playerPos.z = nz;
        moving = true;
      } else if (!this.collides(nx, this.playerPos.z)) {
        this.playerPos.x = nx;
        moving = true;
      } else if (!this.collides(this.playerPos.x, nz)) {
        this.playerPos.z = nz;
        moving = true;
      } else if (this.target) {
        // Bloqueado: si el destino era un edificio y ya estamos junto a la puerta, se entra.
        const enter = this.enterOnArrive;
        if (enter && this.near === enter) this.enter(enter);
        this.target = null;
        this.enterOnArrive = null;
      }
      const ang = Math.atan2(dir.x, dir.z);
      let d = ang - this.player.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.player.root.rotation.y += d * Math.min(1, dt * 14);
    }
    this.player.root.position.x = this.playerPos.x;
    this.player.root.position.z = this.playerPos.z;
    if (moving) animateWalk(this.player, t, 1);
    else animateIdle(this.player, t);

    for (const n of this.npcs) animateIdle(n.rig, t + n.phase);
    for (const w of this.walkers) {
      if (w.wait > 0) {
        w.wait -= dt;
        animateIdle(w.rig, t);
        continue;
      }
      const to = w.target.clone().sub(w.rig.root.position).setY(0);
      if (to.length() < 0.3) {
        w.wait = 1 + Math.random() * 4;
        w.target = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)].clone();
        continue;
      }
      to.normalize();
      w.rig.root.position.addScaledVector(to, w.speed * dt);
      w.rig.root.rotation.y = Math.atan2(to.x, to.z);
      animateWalk(w.rig, t * 0.8, 0.8);
      w.rig.root.position.y = 0;
    }
    if (this.rain && this.rainOn) {
      const p = this.rain.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = p.array as Float32Array;
      const cx = this.attract ? 0 : this.playerPos.x;
      const cz = this.attract ? 0 : this.playerPos.z;
      for (let i = 0; i < arr.length; i += 6) {
        let y = arr[i + 1] - dt * 28;
        if (y < 0) {
          y = 26 + Math.random() * 6;
          const x = cx + (Math.random() * 2 - 1) * 40;
          const z = cz + (Math.random() * 2 - 1) * 40;
          arr[i] = x;
          arr[i + 2] = z;
          arr[i + 3] = x + 0.15;
          arr[i + 5] = z + 0.15;
        }
        arr[i + 1] = y;
        arr[i + 4] = y - 0.9;
      }
      p.needsUpdate = true;
    }
    if (this.bus) {
      this.busX += this.busDir * dt * 6;
      if (Math.abs(this.busX) > 36) {
        this.busDir *= -1;
        this.bus.rotation.y = this.busDir > 0 ? 0 : Math.PI;
      }
      this.bus.position.set(this.busX, Math.abs(Math.sin(t * 9)) * 0.03, 29.5 + (this.busDir > 0 ? 0.9 : -0.9));
    }
    this.adaptQuality(dt);
    const cm = this.clickMarker.material as THREE.MeshBasicMaterial;
    cm.opacity = Math.max(0, cm.opacity - dt * 1.2);

    // Proximidad a puertas
    let nearId: string | null = null;
    for (const inst of this.buildings.values()) {
      const d = this.doorOf(inst.spec).distanceTo(this.playerPos);
      if (d < 2.4) nearId = inst.spec.id;
      if (inst.marker) {
        inst.marker.rotation.y = t * 2;
        inst.marker.position.y = 12.3 + Math.sin(t * 3) * 0.3;
      }
      if (inst.rise < 1) {
        inst.rise = Math.min(1, inst.rise + dt * 0.6);
        const e = 1 - (1 - inst.rise) ** 3;
        inst.group.scale.set(1, Math.max(0.01, e), 1);
      }
    }
    if (nearId !== this.near) {
      this.near = nearId;
      const inst = nearId ? this.buildings.get(nearId)! : null;
      this.cb.onNear(inst?.spec ?? null, inst?.unlocked ?? false);
    }
    const fuente = this.decor.getObjectByName("fuente");
    if (fuente) fuente.rotation.y = t * 0.2;

    // Cámara isométrica siguiendo al jugador
    const focus = new THREE.Vector3(this.playerPos.x, 1, this.playerPos.z);
    let camDir = ISO.clone();
    if (this.attract) {
      this.attractAngle += dt * 0.05;
      focus.set(0, 1, 0);
      camDir = ISO.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.attractAngle);
    } else this.attractAngle = 0;
    const desired = focus.clone().add(camDir.clone().multiplyScalar(60));
    this.camera.position.lerp(desired, Math.min(1, dt * 5));
    const look = this.camera.position.clone().sub(camDir.clone().multiplyScalar(60));
    this.camera.lookAt(look);
    this.renderer.render(this.scene, this.camera);
  };

  enterNear() {
    if (this.near) this.enter(this.near);
  }

  /** Coordenadas en pantalla del jugador (para efectos flotantes). */
  playerScreen(): { x: number; y: number } {
    const p = new THREE.Vector3(this.playerPos.x, 2.6, this.playerPos.z).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }
}

/** Mini escena para la vista previa del personaje. */
export function avatarPreview(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#334", 1.4));
  const d = new THREE.DirectionalLight("#fff", 2);
  d.position.set(3, 5, 4);
  scene.add(d);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 1.6, 6);
  cam.lookAt(0, 1.1, 0);
  let rig: AvatarRig | null = null;
  const size = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  size();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (rig) {
      rig.root.rotation.y += 0.01;
      animateIdle(rig, clock.getElapsedTime());
    }
    renderer.render(scene, cam);
  });
  return {
    set(a: Parameters<typeof buildAvatar>[0]) {
      if (rig) scene.remove(rig.root);
      rig = buildAvatar(a);
      scene.add(rig.root);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
