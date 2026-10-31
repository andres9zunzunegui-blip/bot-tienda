/** Utilidades mínimas de interfaz: creación de nodos, paneles y notificaciones. */

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { class?: string; style?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs)
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === "html") el.innerHTML = String(v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, String(v));
    }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Agrega hijos aceptando arrays y valores nulos (a diferencia de Element.append). */
export function add(el: Node, ...children: Child[]) {
  append(el, children);
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/* --------------------------- Paneles --------------------------- */

let panelCloseHandlers: (() => void)[] = [];

export interface PanelOptions {
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose?: () => void;
  back?: () => void;
}

export function openPanel(opts: PanelOptions, render: (body: HTMLElement) => void): HTMLElement {
  closePanel();
  const body = h("div", { class: "panel-body" });
  const root = h(
    "div",
    { class: "overlay", onclick: (e: Event) => e.target === root && closePanel() },
    h(
      "section",
      { class: `panel ${opts.wide ? "wide" : ""}`, role: "dialog", "aria-label": opts.title },
      h(
        "header",
        { class: "panel-head" },
        opts.back ? h("button", { class: "icon-btn", title: "Volver", onclick: opts.back }, "←") : null,
        h("div", { class: "panel-titles" }, h("h2", null, opts.title), opts.subtitle ? h("p", { class: "muted" }, opts.subtitle) : null),
        h("button", { class: "icon-btn", title: "Cerrar (Esc)", onclick: () => closePanel() }, "✕"),
      ),
      body,
    ),
  );
  document.getElementById("overlays")!.appendChild(root);
  if (opts.onClose) panelCloseHandlers.push(opts.onClose);
  render(body);
  return body;
}

export function closePanel() {
  const root = document.querySelector("#overlays .overlay");
  if (!root) return;
  root.remove();
  const hs = panelCloseHandlers;
  panelCloseHandlers = [];
  for (const fn of hs) fn();
}

export function panelOpen(): boolean {
  return Boolean(document.querySelector("#overlays .overlay"));
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && panelOpen()) closePanel();
});

/* --------------------------- Notificaciones --------------------------- */

export function toast(text: string, tone: "info" | "ok" | "warn" | "error" = "info", ms = 3500) {
  const t = h("div", { class: `toast ${tone}` }, text);
  document.getElementById("toasts")!.appendChild(t);
  setTimeout(() => t.classList.add("out"), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function banner(title: string, sub: string, cls = "") {
  const b = h("div", { class: `banner ${cls}` }, h("strong", null, title), h("span", null, sub));
  document.getElementById("toasts")!.appendChild(b);
  setTimeout(() => b.classList.add("out"), 3200);
  setTimeout(() => b.remove(), 3700);
}

export function bar(value: number, cls = ""): HTMLElement {
  return h("div", { class: `bar ${cls}` }, h("div", { style: `width:${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }));
}

export function pct(v: number): string {
  return `${Math.round(v * 100)} %`;
}

/** Confirmación en dos toques (los diálogos nativos no están disponibles en todos los entornos). */
export function confirmTwice(btn: HTMLButtonElement, prompt: string, action: () => void) {
  if (btn.dataset.armed === "1") return action();
  const original = btn.textContent ?? "";
  btn.dataset.armed = "1";
  btn.textContent = prompt;
  setTimeout(() => {
    btn.dataset.armed = "";
    btn.textContent = original;
  }, 4000);
}
