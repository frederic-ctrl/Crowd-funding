// Een pass die rustig in 3D ronddraait. Slepen of swipen gooit hem sneller rond (de vaart neemt
// daarna vanzelf af), vastpakken houdt hem tegen. Pijltjestoetsen werken ook. Op gsm blijft
// verticaal scrollen werken. Wie minder beweging wil (prefers-reduced-motion), krijgt een
// stilstaande kaart die enkel draait als je eraan zit.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

const CRUISE = 24; // graden per seconde
const MAX_SPIN = 2160; // nooit sneller dan 6 toeren per seconde
const DRAG = 0.55; // graden per pixel slepen

type Drag = { x: number; angle: number; moved: boolean; samples: { t: number; a: number }[] };

export function SpinningPass({ front, back, label, initialSpin = 0 }: { front: ReactNode; back: ReactNode; label: string; initialSpin?: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const sim = useRef({ angle: -22, v: initialSpin, dir: 1, drag: null as Drag | null });

  useEffect(() => {
    const card = cardRef.current;
    const stage = stageRef.current;
    if (!card || !stage) return;
    const cruise = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : CRUISE;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(stage);

    let last = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = sim.current;
      if (!s.drag) {
        s.v += (cruise * s.dir - s.v) * (1 - Math.exp(-0.8 * dt));
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
        aria-roledescription="3D"
        aria-label={label}
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
    </div>
  );
}
