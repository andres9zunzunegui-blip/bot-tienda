/**
 * MOTOR DE JUEGO — mundo isométrico 3D (Three.js).
 * Cámara ortográfica isométrica, ciudad que evoluciona con el progreso,
 * personaje controlable (teclado, clic/toque para caminar), NPCs y misiones visibles.
 */
import * as THREE from "three";
import type { GameState } from "../core/state.ts";
import { effectiveAvatar } from "../content/items.ts";
import { levelFromXp } from "../systems/gamification.ts";
import { animateIdle, animateWalk, buildAvatar, type AvatarRig } from "./avatarMesh.ts";
import { BUILDINGS, constructionSite, type BuildingSpec } from "./buildings.ts";

export interface WorldCallbacks {
  onEnter: (id: string) => void;
  onNear: (spec: BuildingSpec | null, unlocked: boolean) => void;
}

const ISO = new THREE.Vector3(1, 1.15, 1).normalize();
const SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize();
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const WORLD_HALF = 34;

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
    this.refresh(state, true);
    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  /* ------------------------------ Escena ------------------------------ */

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight("#dfefff", "#4b6b3a", 1.1));
    const sun = new THREE.DirectionalLight("#fff2d6", 2.2);
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
    const road = new THREE.MeshStandardMaterial({ color: "#c9c2b0", roughness: 0.95 });
    const strip = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), road);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.02, z);
      m.receiveShadow = true;
      this.scene.add(m);
    };
    strip(0, 0, WORLD_HALF * 2, 3.2);
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

  private tree(x: number, z: number, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 1.2 * s, 6), new THREE.MeshStandardMaterial({ color: "#6b4a2b", flatShading: true }));
    trunk.position.y = 0.6 * s;
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1 * s, 0), new THREE.MeshStandardMaterial({ color: "#3f8a3a", flatShading: true }));
    top.position.y = 1.8 * s;
    g.add(trunk, top);
    g.position.set(x, 0, z);
    g.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o.castShadow = true), (o.receiveShadow = true)) : null));
    return g;
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
      this.decor.add(this.tree(x, z, 0.8 + r() * 0.6));
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
  }

  private updateMarkers(state: GameState) {
    const pending: Record<string, boolean> = {
      tribunal: !state.log.some((l) => l.kind === "simulacion" && l.quality >= 0.6),
      facultad: !state.log.some((l) => l.kind === "oral" && l.quality >= 0.6) || state.cards.some((c) => c.due <= Date.now()),
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
    if (hit?.object.userData.building) {
      const spec = this.buildings.get(hit.object.userData.building)!.spec;
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

  private tick = () => {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
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
    const desired = focus.clone().add(ISO.clone().multiplyScalar(60));
    this.camera.position.lerp(desired, Math.min(1, dt * 5));
    const look = this.camera.position.clone().sub(ISO.clone().multiplyScalar(60));
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
