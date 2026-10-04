"use client";

import { useEffect, useRef, useState } from "react";
import { GarmentArt } from "./garment-art";
import { COMPOSED_QUERIES, COMPOSED_SCENES } from "./composed-scenes";
import styles from "./composed-demo.module.css";

// Labelled composed-search illustration for the landing hero (direction B:
// frontend demo first, live composed API is a separate ticket). Anchor photo
// chip + staged modification + scan feedback + three ranked cards in the same
// rank/category/title/similarity anatomy as production result cards.
// Local fixtures only: zero backend requests, provisional field names, and
// fixture scores that must never be read as live relevance claims.
type Phase = "idle" | "attaching" | "typing" | "searching" | "done";

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduce(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

function useVisible<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const entryVisible = { current: true };
    const updateHidden = () => {
      setVisible(!document.hidden && entryVisible.current);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entryVisible.current = entries[0]?.isIntersecting ?? true;
        updateHidden();
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", updateHidden);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateHidden);
    };
  }, []);

  return [ref, visible];
}

export function ComposedDemo() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [presetIdx, setPresetIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState(0);
  const reduce = useReducedMotion();
  const [ref, visible] = useVisible<HTMLDivElement>();
  const startedRef = useRef(false);
  const scene = COMPOSED_SCENES[sceneIdx];
  const preset = scene.presets[presetIdx];

  function run() {
    startedRef.current = true;
    if (reduce) {
      setTyped(preset.text.length);
      setPhase("done");
      return;
    }
    setTyped(0);
    setPhase("attaching");
  }

  // Autoplay once, the first time the demo scrolls into view.
  useEffect(() => {
    if (visible && !startedRef.current) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduce]);

  // N1: a reduced-motion preference change mid-run (attaching / typing /
  // searching) settles the current scene/preset to its static end state
  // instead of leaving a frozen "typing/searching" status. Uses the
  // current render's preset text (no stale preset); timer effects below
  // bail on `reduce` so their cleanups run. Turning the preference back
  // off does not restart anything (phase is already done; autoplay stays
  // guarded by startedRef, replay/scene/preset handlers still work).
  // Intentional conditional sync (not per-render): only fires on a reduce
  // toggle while a phase is pending.
  useEffect(() => {
    if (!reduce) return;
    if (phase === "attaching" || phase === "typing" || phase === "searching") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTyped(preset.text.length);
      setPhase("done");
    }
  }, [reduce, phase, preset.text]);

  useEffect(() => {
    if (!visible || reduce) return;
    if (phase === "attaching") {
      const t = setTimeout(() => setPhase("typing"), 380);
      return () => clearTimeout(t);
    }
    if (phase === "searching") {
      const t = setTimeout(() => setPhase("done"), 900);
      return () => clearTimeout(t);
    }
  }, [phase, visible, reduce]);

  // Staged typing. Decorative text is aria-hidden; the live region below
  // only announces phase changes, never each character.
  useEffect(() => {
    if (phase !== "typing" || !visible || reduce) return;
    if (typed >= preset.text.length) {
      const t = setTimeout(() => setPhase("searching"), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTyped((n) => n + 1), 45);
    return () => clearTimeout(t);
  }, [phase, typed, visible, reduce, preset.text]);

  function switchScene(i: number) {
    setSceneIdx(i);
    setPresetIdx(0);
    setTyped(0);
    startedRef.current = true;
    if (reduce) {
      setTyped(COMPOSED_SCENES[i].presets[0].text.length);
      setPhase("done");
    } else {
      setPhase("attaching");
    }
  }

  function pickPreset(i: number) {
    setPresetIdx(i);
    setTyped(0);
    startedRef.current = true;
    if (reduce) {
      setTyped(scene.presets[i].text.length);
      setPhase("done");
    } else {
      setPhase("attaching");
    }
  }

  const attached = phase !== "idle";
  const status =
    phase === "searching"
      ? "Đang đối chiếu ảnh + chữ minh họa…"
      : phase === "done"
        ? `Demo: 3 gợi ý minh họa composed cho ảnh + “${preset.text}”.`
        : phase === "typing"
          ? "Đang nhập mô tả thay đổi…"
          : phase === "attaching"
            ? "Đang đính kèm ảnh tham chiếu minh họa…"
            : "Demo minh họa composed — di chuột, chạm hoặc nhấn chạy demo.";

  return (
    <div
      ref={ref}
      className={styles.panel}
      onMouseEnter={() => {
        if (phase === "idle" && !startedRef.current) {
          startedRef.current = true;
          setPhase("attaching");
        }
      }}
    >
      <div className={styles.head}>
        <p className={styles.title}>Tìm bằng ảnh + chữ</p>
        <span className={styles.badge}>Minh họa composed</span>
      </div>

      <div className={styles.chips} role="group" aria-label="Chọn ảnh tham chiếu minh họa">
        {COMPOSED_QUERIES.map((query, i) => (
          <button
            key={query}
            type="button"
            className={i === sceneIdx ? styles.chipActive : styles.chip}
            aria-pressed={i === sceneIdx}
            onClick={() => switchScene(i)}
          >
            {query}
          </button>
        ))}
      </div>

      <div className={styles.bar}>
        <span
          className={`${styles.anchor} ${attached ? styles.anchorIn : ""}`}
          aria-hidden="true"
        >
          <GarmentArt garment={scene.anchor} />
        </span>
        <span className={styles.query} aria-hidden="true">
          {preset.text.slice(0, typed)}
          {phase === "typing" && <span className={styles.caret} />}
        </span>
        <button
          type="button"
          className={styles.go}
          onClick={run}
          aria-label="Chạy demo tìm kiếm composed minh họa"
        >
          Tìm
        </button>
      </div>

      <div className={styles.presets} role="group" aria-label="Chọn mô tả thay đổi">
        {scene.presets.map((p, i) => (
          <button
            key={p.text}
            type="button"
            className={i === presetIdx ? styles.presetActive : styles.preset}
            aria-pressed={i === presetIdx}
            onClick={() => pickPreset(i)}
          >
            {p.text}
          </button>
        ))}
      </div>

      <div className={styles.feedback} aria-hidden="true">
        <span
          className={`${styles.scan} ${phase === "searching" ? styles.scanning : ""} ${phase === "done" ? styles.scanned : ""}`}
        />
      </div>

      <p className={styles.request} aria-label="Hình dạng request minh họa">
        Minh họa request · anchor: {scene.anchor.id} · text: “{preset.text}” · k:{" "}
        {scene.k}
      </p>

      <p className={styles.status} aria-live="polite">
        {status}
      </p>

      <ul className={styles.cards} aria-label="Kết quả minh họa">
        {scene.results.map((item, i) => (
          <li
            key={item.id}
            className={`${styles.card} ${phase === "done" ? styles.shown : ""}`}
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <span className={styles.rank} title={`Hạng ${i + 1}`}>
              {i + 1}
            </span>
            <span className={styles.thumb}>
              <GarmentArt garment={item} />
            </span>
            <span className={styles.cardBody}>
              <span className={styles.cardCategory}>{item.category}</span>
              <span className={styles.cardName}>{item.name}</span>
              <span className={styles.scoreRow}>
                <span>Mức tương đồng</span>
                <strong>{(preset.scores[i] * 100).toFixed(1)}%</strong>
              </span>
            </span>
          </li>
        ))}
      </ul>

      <button type="button" className={styles.replay} onClick={run}>
        Chạy lại demo
      </button>
    </div>
  );
}
