/** Construcción procedural del personaje (low-poly) y su animación de caminata. */
import * as THREE from "three";
import type { Avatar } from "../core/state.ts";

export interface AvatarRig {
  root: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  body: THREE.Object3D;
}

const mat = (c: string, rough = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, flatShading: true });

export function buildAvatar(a: Avatar): AvatarRig {
  const root = new THREE.Group();
  const suit = mat(a.suit);
  const skin = mat(a.skin);
  const pants = mat(new THREE.Color(a.suit).multiplyScalar(0.7).getStyle());
  const shoes = mat("#1a1410");

  const pivot = (x: number, y: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    root.add(g);
    return g;
  };
  const legL = pivot(-0.16, 0.75);
  const legR = pivot(0.16, 0.75);
  for (const leg of [legL, legR]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
    m.position.y = -0.36;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.36), shoes);
    s.position.set(0, -0.72, 0.05);
    leg.add(m, s);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 0.38), suit);
  body.position.y = 1.14;
  root.add(body);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.02), mat("#f2f2f2"));
  shirt.position.set(0, 1.26, 0.2);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.02), mat("#9b1b2a"));
  tie.position.set(0, 1.22, 0.215);
  root.add(shirt, tie);

  const armL = pivot(-0.42, 1.48);
  const armR = pivot(0.42, 1.48);
  for (const arm of [armL, armR]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.22), suit);
    m.position.y = -0.33;
    const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), skin);
    hnd.position.y = -0.72;
    arm.add(m, hnd);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.44), skin);
  head.position.y = 1.82;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.48), mat(a.hair));
  hair.position.y = 2.08;
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.12), mat(a.hair));
  hairBack.position.set(0, 1.94, -0.2);
  const eyeM = mat("#151515");
  const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), eyeM);
  e1.position.set(-0.1, 1.86, 0.225);
  const e2 = e1.clone();
  e2.position.x = 0.1;
  root.add(head, hair, hairBack, e1, e2);

  if (a.glasses) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.02), mat("#c9a227", 0.3));
    g.position.set(0, 1.87, 0.235);
    root.add(g);
  }
  if (a.accessory === "maletin") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.5), mat("#5a3a1e"));
    b.position.set(0, -0.86, 0.05);
    armR.add(b);
  } else if (a.accessory === "codigo") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.32), mat("#8c1d1d"));
    b.position.set(0.02, -0.7, 0.12);
    armL.add(b);
  } else if (a.accessory === "toga") {
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.4, 8, 1, true), mat("#121212"));
    robe.position.y = 0.95;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), mat("#121212"));
    cap.position.y = 2.18;
    root.add(robe, cap);
  }
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { root, legL, legR, armL, armR, body };
}

export function animateWalk(r: AvatarRig, t: number, speed: number) {
  const a = Math.sin(t * 10) * 0.6 * speed;
  r.legL.rotation.x = a;
  r.legR.rotation.x = -a;
  r.armL.rotation.x = -a * 0.8;
  r.armR.rotation.x = a * 0.8;
  r.root.position.y = Math.abs(Math.sin(t * 10)) * 0.06 * speed;
}

export function animateIdle(r: AvatarRig, t: number) {
  r.legL.rotation.x *= 0.8;
  r.legR.rotation.x *= 0.8;
  r.armL.rotation.x = Math.sin(t * 1.6) * 0.05;
  r.armR.rotation.x = -Math.sin(t * 1.6) * 0.05;
  r.root.position.y = 0;
}
