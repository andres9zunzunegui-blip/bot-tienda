/** AULA DE REELS: teoría en formato vertical animado, con mini-preguntas obligatorias. */
import { CHAPTERS, chapter, type Chapter, type Reel } from "../../content/chapters.ts";
import { store } from "../../core/state.ts";
import { getRef } from "../../legal/sources.ts";
import { loadMaterial } from "../../modules/materials/storage.ts";
import { materialChapter } from "../../modules/reels/materialReels.ts";
import { REQUIREMENTS, chapterDone, missingChapters } from "../../modules/reels/progress.ts";
import { recordActivity } from "../../systems/gamification.ts";
import { newCard, upsertCard } from "../../systems/memory.ts";
import { contentCardsFor } from "../../systems/seed.ts";
import { add, clear, h, openPanel, pct, toast } from "../dom.ts";
import { go, registerScreen } from "../nav.ts";

/* ------------------------------ Índice de capítulos ------------------------------ */

export function openLearn() {
  openPanel({ title: "Aula de reels", subtitle: "Aprendé la teoría antes de enfrentar los casos", wide: true }, (body) => {
    const s = store.state;
    const done = CHAPTERS.filter((c) => chapterDone(s, c.id)).length;
    const next = CHAPTERS.find((c) => !chapterDone(s, c.id));
    add(
      body,
      h("p", { class: "notice info" }, `Completaste ${done} de ${CHAPTERS.length} capítulos. Cada capítulo son reels cortos con animaciones y mini-preguntas: para seguir hay que responderlas.`),
      h(
        "div",
        { class: "chapters" },
        CHAPTERS.map((c) => {
          const st = s.chapters[c.id];
          return h(
            "button",
            { class: `chapter-card ${st?.done ? "done" : ""} ${next?.id === c.id ? "next" : ""}`, style: `--c:${c.color}`, onclick: () => openReels(c) },
            h("span", { class: "chapter-n" }, `Capítulo ${c.number}`),
            h("b", null, c.title),
            h("small", null, c.subtitle),
            h("span", { class: "chapter-meta" }, `${c.reels.length} reels · ${c.reels.filter((r) => r.kind === "check").length} preguntas`),
            st?.done ? h("span", { class: "tag ok" }, `✔ completado · ${pct(st.best)}`) : next?.id === c.id ? h("span", { class: "tag warn" }, "▶ siguiente") : h("span", { class: "tag" }, "pendiente"),
          );
        }),
      ),
      h("h3", null, "Qué desbloquea cada capítulo"),
      h(
        "table",
        { class: "t" },
        Object.values(REQUIREMENTS).map((r) =>
          h("tr", null, h("td", null, r.label), h("td", null, r.chapters.map((id) => h("span", { class: `tag ${chapterDone(s, id) ? "ok" : ""}`, style: "margin-right:4px" }, `Cap. ${chapter(id).number}`)))),
        ),
      ),
    );
    const matBox = h("div");
    add(body, h("h3", null, "Reels de tu material"), matBox);
    const mats = s.materials.filter((m) => m.processed !== "no");
    if (!mats.length) add(matBox, h("p", { class: "muted" }, "Cuando cargues apuntes, se convierten en reels automáticamente."), h("button", { class: "btn", onclick: () => go("upload") }, "Cargar material"));
    for (const m of mats)
      add(
        matBox,
        h("button", {
          class: "btn",
          style: "margin:4px",
          onclick: async () => {
            const st = await loadMaterial(m.id).catch(() => null);
            if (!st?.processed) return toast("No se encontró el material en este navegador.", "warn");
            const ch = materialChapter(m.id, m.name, st.processed);
            if (ch.reels.length < 2) return toast("Este material no tiene conceptos suficientes para armar reels.", "warn");
            openReels(ch);
          },
        }, `🎬 ${m.name}`),
      );
  });
}

/* ------------------------------ Reproductor ------------------------------ */

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function durationOf(r: Reel): number {
  if (r.kind === "check") return Infinity;
  const text = JSON.stringify(r).length;
  return Math.min(17000, 6500 + text * 18);
}

export function openReels(ch: Chapter) {
  let i = 0;
  let paused = false;
  let voice = false;
  let elapsed = 0;
  let last = performance.now();
  let raf = 0;
  let finished = false;
  const answers: (number | null)[] = ch.reels.map(() => null);
  const firstTry: boolean[] = ch.reels.map(() => false);
  let onKey: (e: KeyboardEvent) => void = () => {};

  const stop = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey);
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  };

  openPanel({ title: `Capítulo ${ch.number}: ${ch.title}`, subtitle: ch.subtitle, wide: true, cls: "reels-panel", onClose: stop, back: () => (stop(), openLearn()) }, (body) => {
    const bars = h("div", { class: "reel-bars" }, ch.reels.map(() => h("span", null, h("i"))));
    const content = h("div", { class: "reel-content" });
    const caption = h("div", { class: "reel-caption" });
    const pauseBtn = h("button", { class: "reel-btn", title: "Pausar", onclick: () => togglePause() }, "⏸");
    const voiceBtn = h("button", { class: "reel-btn", title: "Narración por voz", onclick: () => ((voice = !voice), voiceBtn.classList.toggle("on", voice), voice ? speak() : speechSynthesis?.cancel()) }, "🔊");
    const saveBtn = h("button", { class: "reel-btn", title: "Guardar en el entrenador de memoria", onclick: () => save() }, "❤");
    const phone = h(
      "div",
      { class: "reel-phone", style: `--c:${ch.color}` },
      bars,
      h("div", { class: "reel-top" }, h("span", null, `Cap. ${ch.number} · ${ch.title}`), h("span", { class: "reel-count" })),
      content,
      caption,
      h("div", { class: "reel-rail" }, saveBtn, voiceBtn, pauseBtn),
      h("button", { class: "reel-tap left", "aria-label": "Reel anterior", onclick: () => prev() }),
      h("button", { class: "reel-tap right", "aria-label": "Reel siguiente", onclick: () => next() }),
    );
    const nav = h("div", { class: "reel-nav" }, h("button", { class: "icon-btn", title: "Anterior (↑)", onclick: () => prev() }, "▲"), h("button", { class: "icon-btn", title: "Siguiente (↓)", onclick: () => next() }, "▼"));
    add(body, h("div", { class: "reel-wrap" }, phone, nav), h("p", { class: "muted reel-help" }, "Tocá a la derecha o deslizá hacia arriba para avanzar · mantené pulsado para pausar · las preguntas hay que responderlas para seguir"));

    // Gestos: deslizar y mantener pulsado
    let ty = 0;
    let holdTimer = 0;
    phone.addEventListener("touchstart", (e) => {
      ty = e.touches[0].clientY;
      holdTimer = window.setTimeout(() => setPaused(true), 350);
    }, { passive: true });
    phone.addEventListener("touchend", (e) => {
      clearTimeout(holdTimer);
      const dy = e.changedTouches[0].clientY - ty;
      if (dy < -50) next();
      else if (dy > 50) prev();
    });
    let wheelLock = 0;
    phone.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (Date.now() < wheelLock || Math.abs(e.deltaY) < 20) return;
      wheelLock = Date.now() + 600;
      if (e.deltaY > 0) next();
      else prev();
    }, { passive: false });

    const togglePause = () => setPaused(!paused);
    function setPaused(p: boolean) {
      paused = p;
      pauseBtn.textContent = p ? "▶" : "⏸";
      phone.classList.toggle("paused", p);
      if ("speechSynthesis" in window) p ? speechSynthesis.pause() : speechSynthesis.resume();
    }

    const speak = () => {
      if (!voice || !("speechSynthesis" in window)) return;
      speechSynthesis.cancel();
      const r = ch.reels[i];
      const text = r.kind === "check" ? `${r.question}. ${r.options.join(". ")}` : `${r.title}. ${reelSpoken(r)}`;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-AR";
      speechSynthesis.speak(u);
    };

    const save = () => {
      const r = ch.reels[i];
      const prompt = r.kind === "check" ? r.question : r.title;
      const answer = r.kind === "check" ? `${r.options[r.correct]}. ${r.explain}` : reelSpoken(r);
      store.update("reel-save", (s) => (s.cards = upsertCard(s.cards, newCard(`reel:${ch.id}:${i}`, ch.topic, prompt, answer, "contenido"), true)));
      saveBtn.classList.add("on");
      toast("Guardado en el entrenador de memoria", "ok", 1800);
    };

    const render = () => {
      elapsed = 0;
      const r = ch.reels[i];
      phone.querySelector(".reel-count")!.textContent = `${i + 1}/${ch.reels.length}`;
      saveBtn.classList.remove("on");
      bars.querySelectorAll("span").forEach((b, k) => {
        b.classList.toggle("done", k < i);
        (b.firstChild as HTMLElement).style.width = k < i ? "100%" : "0%";
      });
      clear(content);
      clear(caption);
      content.className = `reel-content k-${r.kind}`;
      add(content, renderReel(r, i));
      if (r.kind !== "check") {
        add(caption, h("p", null, r.caption));
        if (r.refs?.length)
          add(caption, h("div", { class: "reel-refs" }, r.refs.map((id) => {
            const ref = getRef(id);
            return h("span", { class: `tag ${ref.verificacion.estado === "discrepancia" ? "bad" : "warn"}`, title: `${ref.norma} — ${ref.verificacion.detalle}` }, `${ref.articulo} · verificar`);
          })));
      }
      speak();
    };

    function renderReel(r: Reel, idx: number): HTMLElement {
      switch (r.kind) {
        case "intro":
          return h("div", { class: "r-intro" }, h("h2", null, r.title), h("div", { class: "r-words" }, r.words.map((w, k) => h("span", { style: `animation-delay:${0.5 + k * 0.55}s` }, w))));
        case "lista":
          return h("div", null, h("h2", null, r.title), h("ul", { class: "r-list" }, r.items.map((it, k) => h("li", { style: `animation-delay:${0.3 + k * 0.45}s` }, h("span", { class: "r-ico" }, it.icon), it.text))));
        case "comparar":
          return h(
            "div",
            null,
            h("h2", null, r.title),
            h("div", { class: "r-vs" }, h("div", { class: "r-col l" }, h("h3", null, r.left.title), h("ul", null, r.left.items.map((x) => h("li", null, x)))), h("div", { class: "r-vs-badge" }, "VS"), h("div", { class: "r-col r" }, h("h3", null, r.right.title), h("ul", null, r.right.items.map((x) => h("li", null, x))))),
          );
        case "linea":
          return h("div", null, h("h2", null, r.title), h("ol", { class: "r-line" }, r.steps.map((st, k) => h("li", { style: `animation-delay:${0.4 + k * 0.9}s` }, h("b", null, st.label), h("small", null, st.sub)))));
        case "dato": {
          const big = h("div", { class: "r-big" }, r.big);
          return h("div", { class: "r-dato" }, h("h2", null, r.title), big, h("div", { class: "r-unit" }, r.unit));
        }
        case "caso":
          return h("div", null, h("h2", null, r.title), h("div", { class: "r-chat" }, r.lines.map((l, k) => h("div", { class: `r-bubble ${k % 2 ? "alt" : ""}`, style: `animation-delay:${0.4 + k * 1.3}s` }, h("span", { class: "r-who" }, l.who), h("div", null, h("b", null, l.name), h("p", null, l.text))))));
        case "alerta":
          return h("div", { class: "r-alert" }, h("div", { class: "r-alert-ico" }, "⚠"), h("h2", null, r.title), h("p", null, r.text));
        case "calendario":
          return h(
            "div",
            null,
            h("h2", null, r.title),
            h("div", { class: "r-cal" }, r.days.map((d, k) => {
              const n = r.days.slice(0, k + 1).filter((x) => x.mark === "habil" || x.mark === "audiencia" || x.mark === "minimo").length;
              const label = d.mark === "acta" ? "ACTA" : d.mark === "finde" ? "no cuenta" : d.mark === "audiencia" ? `día ${n} · AUDIENCIA` : d.mark === "minimo" ? `día ${n} · mínimo` : `día ${n}`;
              return h("div", { class: `r-day ${d.mark}`, style: `animation-delay:${0.3 + k * 0.6}s` }, h("b", null, d.label), h("small", null, label));
            })),
          );
        case "check": {
          const fb = h("div", { class: "r-fb" });
          const opts = r.options.map((o, k) =>
            h("button", {
              class: `r-opt ${answers[idx] !== null && k === r.correct ? "good" : ""} ${answers[idx] === k && k !== r.correct ? "bad" : ""}`,
              disabled: answers[idx] === r.correct,
              onclick: () => {
                if (answers[idx] === r.correct) return;
                const firstAttempt = answers[idx] === null;
                answers[idx] = k;
                if (k === r.correct) {
                  if (firstAttempt) firstTry[idx] = true;
                  elapsed = 0;
                } else if (navigator.vibrate) navigator.vibrate(80);
                clear(content);
                add(content, renderReel(r, idx));
              },
            }, o),
          );
          if (answers[idx] !== null) {
            const ok = answers[idx] === r.correct;
            add(fb, h("p", { class: ok ? "ok" : "bad" }, ok ? (firstTry[idx] ? "¡Correcto!" : "Correcto (al segundo intento).") : "No es así. Probá otra vez."), ok ? h("p", null, r.explain) : null, ok ? h("button", { class: "btn gold", onclick: () => next() }, "Seguir ▼") : null);
          }
          return h("div", { class: "r-check" }, h("span", { class: "r-q-badge" }, "PREGUNTA"), h("h2", null, r.question), h("div", { class: "r-opts" }, opts), fb);
        }
      }
    }

    function canLeave(): boolean {
      const r = ch.reels[i];
      if (r.kind === "check" && answers[i] !== r.correct) {
        phone.classList.remove("shake");
        void phone.offsetWidth;
        phone.classList.add("shake");
        toast("Respondé la pregunta para seguir", "warn", 1500);
        return false;
      }
      return true;
    }

    function next() {
      if (finished) return;
      if (!canLeave()) return;
      if (i < ch.reels.length - 1) {
        i++;
        render();
      } else finish();
    }
    function prev() {
      if (finished || i === 0) return;
      i--;
      render();
    }

    onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      if (["ArrowDown", "ArrowRight", "PageDown"].includes(e.key)) (e.preventDefault(), next());
      if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) (e.preventDefault(), prev());
      if (e.key === " ") (e.preventDefault(), togglePause());
    };
    window.addEventListener("keydown", onKey);

    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      if (!paused && !finished && document.body.contains(phone)) {
        const r = ch.reels[i];
        const dur = r.kind === "check" ? (answers[i] === r.correct ? 6000 : Infinity) : durationOf(r);
        const speaking = voice && "speechSynthesis" in window && speechSynthesis.speaking;
        elapsed += dt;
        const bar = bars.children[i]?.firstChild as HTMLElement | undefined;
        if (bar) bar.style.width = `${Math.min(100, (elapsed / dur) * 100)}%`;
        if (elapsed >= dur && !speaking && !reduceMotion()) next();
        else if (elapsed >= dur && !speaking && reduceMotion()) bar && (bar.style.width = "100%");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    function finish() {
      finished = true;
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      const checks = ch.reels.map((r, k) => ({ r, k })).filter((x) => x.r.kind === "check");
      const ok = checks.filter((x) => firstTry[x.k]).length;
      const quality = checks.length ? ok / checks.length : 1;
      const isMaterial = ch.id.startsWith("mat-");
      const missingBefore = Object.fromEntries(Object.keys(REQUIREMENTS).map((k) => [k, missingChapters(store.state, k).length]));
      store.update("chapter", (s) => {
        const prevBest = s.chapters[ch.id]?.best ?? 0;
        s.chapters[ch.id] = { seen: ch.reels.length, done: true, best: Math.max(prevBest, quality), at: Date.now() };
        if (!isMaterial) for (const t of ch.topics) for (const c of contentCardsFor(t)) s.cards = upsertCard(s.cards, c);
      });
      const r = recordActivity({
        kind: "estudio",
        id: `cap:${ch.id}`,
        topic: ch.topic,
        quality,
        label: `Capítulo ${ch.number}: ${ch.title}`,
        topicQualities: Object.fromEntries(ch.topics.map((t) => [t, quality])),
        errors: checks
          .filter((x) => !firstTry[x.k])
          .map((x) => {
            const c = x.r as Extract<Reel, { kind: "check" }>;
            return { topic: ch.topic, description: `Reel: ${c.question}`, prompt: c.question, answer: `${c.options[c.correct]}. ${c.explain}` };
          }),
      });
      const unlocked = Object.entries(REQUIREMENTS).filter(([k]) => missingBefore[k] > 0 && missingChapters(store.state, k).length === 0).map(([, v]) => v.label);
      const nextCh = CHAPTERS.find((c) => !chapterDone(store.state, c.id));
      clear(content);
      clear(caption);
      content.className = "reel-content k-fin";
      bars.querySelectorAll("span").forEach((b) => (((b.firstChild as HTMLElement).style.width = "100%"), b.classList.add("done")));
      add(
        content,
        h(
          "div",
          { class: "r-fin" },
          h("div", { class: "r-fin-ico" }, "🎓"),
          h("h2", null, "¡Capítulo completado!"),
          h("p", null, `Preguntas acertadas al primer intento: ${ok}/${checks.length} (${pct(quality)})`),
          h("p", null, `+${r.xp} XP${r.coins ? ` · +${r.coins} 🪙` : ""}`),
          !isMaterial ? h("p", { class: "muted" }, "Las ideas clave se agregaron al entrenador de memoria.") : null,
          unlocked.length ? h("p", { class: "r-unlock" }, `🔓 Desbloqueaste: ${unlocked.join(", ")}`) : null,
          h(
            "div",
            { class: "r-fin-actions" },
            nextCh && !isMaterial ? h("button", { class: "btn gold", onclick: () => (stop(), openReels(nextCh)) }, `▶ Capítulo ${nextCh.number}: ${nextCh.title}`) : null,
            !nextCh && !isMaterial ? h("button", { class: "btn gold", onclick: () => (stop(), go("simulations")) }, "⚖️ Ir al caso de clausura") : null,
            h("button", { class: "btn", onclick: () => (stop(), openReels(ch)) }, "Ver de nuevo"),
            h("button", { class: "btn", onclick: () => (stop(), openLearn()) }, "Todos los capítulos"),
          ),
        ),
      );
    }

    render();
  });
}

function reelSpoken(r: Reel): string {
  switch (r.kind) {
    case "intro":
      return `${r.words.join(" ")} ${r.caption}`;
    case "lista":
      return `${r.items.map((x) => x.text).join(" ")} ${r.caption}`;
    case "comparar":
      return `${r.left.title}: ${r.left.items.join(", ")}. ${r.right.title}: ${r.right.items.join(", ")}. ${r.caption}`;
    case "linea":
      return `${r.steps.map((s) => `${s.label}: ${s.sub}`).join(". ")}. ${r.caption}`;
    case "dato":
      return `${r.big} ${r.unit}. ${r.caption}`;
    case "caso":
      return `${r.lines.map((l) => `${l.name}: ${l.text}`).join(" ")} ${r.caption}`;
    case "alerta":
      return `${r.text} ${r.caption}`;
    case "calendario":
      return r.caption;
    case "check":
      return r.explain;
  }
}

registerScreen("learn", openLearn);
registerScreen("reels", (arg) => openReels(typeof arg === "string" ? chapter(arg) : CHAPTERS.find((c) => !chapterDone(store.state, c.id)) ?? CHAPTERS[0]));
