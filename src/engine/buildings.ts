/** Edificios de la ciudad universitaria y jurídica, construidos proceduralmente. */
import * as THREE from "three";

export interface BuildingSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  icon: string;
  build: () => THREE.Group;
}

const M = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: true, ...o });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

function windows(g: THREE.Group, w: number, d: number, rows: number, y0: number, dy: number, color = "#ffe9a8") {
  const wm = M(color, { emissive: color, emissiveIntensity: 0.35 });
  const cols = Math.max(2, Math.floor(w / 1.4));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      g.add(box(0.55, 0.75, 0.05, wm, x, y0 + r * dy, d / 2 + 0.01));
    }
}

function columns(g: THREE.Group, w: number, z: number, h: number, n: number, m: THREE.Material) {
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, h, 10), m);
    c.position.set(-w / 2 + (w / (n - 1)) * i, h / 2 + 0.6, z);
    g.add(c);
  }
}

function steps(g: THREE.Group, w: number, z: number, m: THREE.Material) {
  for (let i = 0; i < 3; i++) g.add(box(w - i * 0.4, 0.2, 0.6, m, 0, i * 0.2, z + 0.9 - i * 0.4));
}

function door(g: THREE.Group, z: number, color = "#4a2f1a") {
  g.add(box(1.2, 2, 0.1, M(color), 0, 0.6, z));
}

function pediment(w: number, d: number, y: number, m: THREE.Material) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, 1.4);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(0, y, -d / 2);
  return mesh;
}

export const BUILDINGS: BuildingSpec[] = [
  {
    id: "facultad",
    name: "Facultad de Derecho",
    x: -11,
    z: -9,
    w: 9,
    d: 6,
    icon: "🏛️",
    build() {
      const g = new THREE.Group();
      const stone = M("#e8dcc4");
      const trim = M("#c9b991");
      g.add(box(9, 0.6, 6.6, trim));
      g.add(box(8.4, 4.4, 5, stone, 0, 0.6, -0.5));
      windows(g, 8.4, 4, 2, 1.2, 1.6, "#ffe9a8");
      columns(g, 7.6, 2.4, 3.8, 6, M("#f5efe2"));
      g.add(box(8.6, 0.4, 2.2, trim, 0, 4.4, 1.6));
      g.add(pediment(8.6, 6.4, 5, M("#d8c9a4")));
      g.add(box(8.8, 0.3, 6.6, M("#3c5a8a"), 0, 5, 0));
      steps(g, 5, 3.1, trim);
      door(g, 2.0);
      return g;
    },
  },
  {
    id: "tribunal",
    name: "Tribunales",
    x: 11,
    z: -9,
    w: 9,
    d: 6,
    icon: "⚖️",
    build() {
      const g = new THREE.Group();
      const stone = M("#d9d6cf");
      g.add(box(9, 0.6, 6.6, M("#a9a49a")));
      g.add(box(8.4, 5, 5, stone, 0, 0.6, -0.5));
      windows(g, 8.4, 4, 2, 1.3, 1.8, "#cfe3ff");
      columns(g, 7.6, 2.4, 4.4, 8, M("#efece6"));
      g.add(box(8.6, 0.5, 2.2, M("#b8b3a8"), 0, 5, 1.6));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M("#5f8f7a", { roughness: 0.4 }));
      dome.position.set(0, 5.6, -0.5);
      g.add(box(4.6, 0.6, 4.6, stone, 0, 5.6 - 0.6, -0.5), dome);
      const lantern = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 8), M("#e3b448", { metalness: 0.6, roughness: 0.3 }));
      lantern.position.set(0, 8.2, -0.5);
      g.add(lantern);
      steps(g, 6, 3.1, M("#b8b3a8"));
      door(g, 2.0, "#2a2a2a");
      return g;
    },
  },
  {
    id: "biblioteca",
    name: "Biblioteca jurídica",
    x: -13,
    z: 7,
    w: 7,
    d: 5,
    icon: "📚",
    build() {
      const g = new THREE.Group();
      g.add(box(7, 4, 5, M("#9b4a33")));
      windows(g, 7, 5, 2, 0.8, 1.6, "#ffd98a");
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.2, 4), M("#3d2b24"));
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(1, 1, 0.75);
      roof.position.y = 5.1;
      g.add(roof);
      door(g, 2.51, "#2c1a10");
      return g;
    },
  },
  {
    id: "estudio",
    name: "Estudio jurídico",
    x: 13,
    z: 7,
    w: 5,
    d: 5,
    icon: "🏢",
    build() {
      const g = new THREE.Group();
      const glass = M("#5d86b8", { roughness: 0.2, metalness: 0.4 });
      g.add(box(5, 9, 5, glass));
      for (let y = 1; y < 9; y += 1.5) g.add(box(5.1, 0.12, 5.1, M("#d9e4f2"), 0, y, 0));
      g.add(box(5.2, 0.4, 5.2, M("#2c3e5c"), 0, 9, 0));
      g.add(box(2.4, 0.5, 0.2, M("#e3b448", { emissive: "#e3b448", emissiveIntensity: 0.4 }), 0, 2.4, 2.56));
      door(g, 2.52, "#1c2a40");
      return g;
    },
  },
  {
    id: "arca",
    name: "Organismo recaudador (ARCA)",
    x: 0,
    z: -21,
    w: 8,
    d: 5,
    icon: "🏦",
    build() {
      const g = new THREE.Group();
      g.add(box(8, 5.5, 5, M("#8f99a6")));
      windows(g, 8, 5, 3, 0.8, 1.5, "#d6ecff");
      g.add(box(8.2, 0.4, 5.2, M("#4f5966"), 0, 5.5, 0));
      g.add(box(3, 0.6, 0.2, M("#1f6fb2", { emissive: "#1f6fb2", emissiveIntensity: 0.4 }), 0, 4.5, 2.56));
      door(g, 2.52, "#2b3440");
      return g;
    },
  },
  {
    id: "audiencias",
    name: "Sala de audiencias",
    x: 23,
    z: -2,
    w: 6,
    d: 6,
    icon: "🔨",
    build() {
      const g = new THREE.Group();
      g.add(box(6, 4.5, 6, M("#c7b39a")));
      windows(g, 6, 6, 2, 0.8, 1.7, "#ffe9a8");
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 4.6, 2, 4), M("#6b3b2a"));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 5.5;
      g.add(roof);
      door(g, 3.01);
      return g;
    },
  },
  {
    id: "investigacion",
    name: "Centro de investigación",
    x: -23,
    z: -2,
    w: 6,
    d: 6,
    icon: "🔬",
    build() {
      const g = new THREE.Group();
      g.add(box(6, 4, 6, M("#e9eef5")));
      windows(g, 6, 6, 2, 0.8, 1.5, "#bfe8ff");
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M("#9fb3c8", { metalness: 0.5, roughness: 0.3 }));
      dome.position.y = 4;
      g.add(dome);
      door(g, 3.01, "#3a4a5a");
      return g;
    },
  },
  {
    id: "archivo",
    name: "Archivo judicial",
    x: 0,
    z: 19,
    w: 9,
    d: 4,
    icon: "🗄️",
    build() {
      const g = new THREE.Group();
      g.add(box(9, 3.2, 4, M("#b9a37c")));
      windows(g, 9, 4, 1, 1, 1, "#ffe0a0");
      g.add(box(9.4, 0.4, 4.4, M("#6d5a3a"), 0, 3.2, 0));
      door(g, 2.01, "#3b2c18");
      return g;
    },
  },
  {
    id: "entrenamiento",
    name: "Centro de entrenamiento académico",
    x: -13,
    z: 20,
    w: 6,
    d: 5,
    icon: "🏋️",
    build() {
      const g = new THREE.Group();
      g.add(box(6, 3.6, 5, M("#4c7a5c")));
      windows(g, 6, 5, 1, 1, 1, "#ffffff");
      const arc = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.3, 6, 16, Math.PI), M("#e3b448"));
      arc.position.set(0, 3.6, 0);
      g.add(arc);
      door(g, 2.51, "#203628");
      return g;
    },
  },
];

/** Obra en construcción: representa un edificio todavía bloqueado. */
export function constructionSite(spec: BuildingSpec): THREE.Group {
  const g = new THREE.Group();
  const wood = M("#a87b47");
  const pole = M("#d9a441");
  g.add(box(spec.w, 0.4, spec.d, M("#8a8577")));
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    g.add(box(0.15, 3.5, 0.15, pole, (x * spec.w) / 2.2, 0.4, (z * spec.d) / 2.2));
  g.add(box(spec.w * 0.95, 0.12, 0.15, wood, 0, 2, spec.d / 2.2));
  g.add(box(spec.w * 0.95, 0.12, 0.15, wood, 0, 3.4, spec.d / 2.2));
  g.add(box(spec.w * 0.6, 1.2, spec.d * 0.6, M("#c9c1ad"), 0, 0.4, 0));
  // Grúa
  g.add(box(0.3, 7, 0.3, M("#e3b448"), spec.w / 2 - 0.5, 0, -spec.d / 2 + 0.5));
  g.add(box(4, 0.25, 0.25, M("#e3b448"), spec.w / 2 - 1.8, 7, -spec.d / 2 + 0.5));
  // Cartel
  g.add(box(1.8, 1, 0.08, M("#f0a83a"), 0, 0.7, spec.d / 2 + 0.3));
  return g;
}
