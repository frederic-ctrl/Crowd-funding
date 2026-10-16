// Een pass die in 3D ronddraait. Slepen of swipen gooit hem sneller rond (de vaart neemt
// daarna rustig af), vastpakken remt hem af, en met de knoppen kies je de snelheid waarop hij
// blijft draaien. Op gsm blijft verticaal scrollen werken. Wie minder beweging wil
// (prefers-reduced-motion), krijgt een stilstaande kaart die enkel draait als je eraan zit.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

const SPEEDS = [0, 12, 28, 60, 140, 320]; // graden per seconde
const DEFAULT_LEVEL = 2;
const MAX_SPIN = 2160; // nooit sneller dan 6 toeren per seconde
const DRAG = 0.55; // graden per pixel slepen

type Drag = { x: number; angle: number; moved: boolean; samples: { t: number; a: number }[] };

export function SpinningPass({
  front,
  back,
  label,
  controls = true,
  initialSpin = 0,
}: {
  front: ReactNode;
  back: ReactNode;
  label: string;
  controls?: boolean;
  /** Startvaart in graden per seconde, bv. om een net geclaimde pass feestelijk rond te laten tollen. */
  initialSpin?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [level, setLevel] = useState(reduced ? 0 : DEFAULT_LEVEL);
  const [dragging, setDragging] = useState(false);
  const sim = useRef({ angle: -22, v: initialSpin, dir: 1, base: SPEEDS[reduced ? 0 : DEFAULT_LEVEL], drag: null as Drag | null });

  useEffect(() => {
    sim.current.base = SPEEDS[level];
  }, [level]);

  useEffect(() => {
    const card = cardRef.current;
    const stage = stageRef.current;
    if (!card || !stage) return;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(stage);

    let last = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = sim.current;
      if (!s.drag) {
        // De vaart zakt rustig terug naar de gekozen snelheid, in de laatst gegooide richting.
        const target = s.base * s.dir;
        s.v += (target - s.v) * (1 - Math.exp(-0.8 * dt));
        s.angle += s.v * dt;
      }
      if (visible) {
        const lean = Math.max(-10, Math.min(10, s.v / 120));
        card.style.transform = `rotateX(${6 - Math.abs(lean) / 3}deg) rotateY(${s.angle}deg) rotateZ(${-lean / 4}deg)`;
        const turn = (((s.angle % 360) + 360) % 360) / 360;
        card.style.setProperty("--glare", `${(turn * 300 - 100).toFixed(1)}%`);
      }
      raf = requestAnimationFrame(frame);
    });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const s = sim.current;
    // Vastpakken: de kaart stopt onder je vinger.
    s.drag = { x: e.clientX, angle: s.angle, moved: false, samples: [{ t: e.timeStamp, a: s.angle }] };
    s.v = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const d = sim.current.drag;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    sim.current.angle = d.angle + dx * DRAG;
    d.samples.push({ t: e.timeStamp, a: sim.current.angle });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 90) d.samples.shift();
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    const s = sim.current;
    const d = s.drag;
    if (!d) return;
    s.drag = null;
    setDragging(false);
    const first = d.samples[0];
    const lastSample = d.samples[d.samples.length - 1];
    const dt = (lastSample.t - first.t) / 1000;
    // Gooien: de snelheid van de laatste beweging wordt de nieuwe vaart.
    if (d.moved && dt > 0 && e.timeStamp - lastSample.t < 120) {
      s.v = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, (lastSample.a - first.a) / dt));
      if (Math.abs(s.v) > 5) s.dir = Math.sign(s.v);
    }
  }

  function key(e: KeyboardEvent<HTMLDivElement>) {
    const s = sim.current;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      s.v = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, s.v + dir * 360));
      s.dir = dir;
      e.preventDefault();
    } else if (e.key === "ArrowDown" || e.key === " ") {
      s.v *= 0.3;
      e.preventDefault();
    }
  }

  return (
    <div className="spin">
      <div
        ref={stageRef}
        className={`spin-stage${dragging ? " is-dragging" : ""}`}
        role="group"
        aria-roledescription="draaiende kaart"
        aria-label={`${label}. Sleep, swipe of gebruik de pijltjestoetsen om de kaart te laten draaien.`}
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
      >
        <div ref={cardRef} className="spin-card">
          <div className="spin-face spin-front" aria-hidden="true">
            {front}
            <span className="spin-glare" />
          </div>
          <div className="spin-face spin-back" aria-hidden="true">
            {back}
            <span className="spin-glare" />
          </div>
        </div>
      </div>
      {controls && (
        <div className="spin-controls">
          <button type="button" className="spin-btn" onClick={() => setLevel((l) => Math.max(0, l - 1))} disabled={level === 0} aria-label="Trager draaien">
            −
          </button>
          <span className="spin-meter" role="status" aria-label={level === 0 ? "Staat stil" : `Snelheid ${level} van ${SPEEDS.length - 1}`}>
            {SPEEDS.slice(1).map((_, i) => (
              <i key={i} className={i < level ? "on" : ""} />
            ))}
          </span>
          <button type="button" className="spin-btn" onClick={() => setLevel((l) => Math.min(SPEEDS.length - 1, l + 1))} disabled={level === SPEEDS.length - 1} aria-label="Sneller draaien">
            +
          </button>
          <span className="spin-hint">Sleep om hem rond te gooien</span>
        </div>
      )}
    </div>
  );
}
