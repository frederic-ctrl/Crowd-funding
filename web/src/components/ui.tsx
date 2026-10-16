import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { explorerAddress } from "../lib/explorer";
import { shortAddress } from "../lib/format";
import { useLang } from "../i18n";

export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="#2f5bea" />
      <path d="M6 12 H 18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 8 H 13" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 16 H 15" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ width = "4ch" }: { width?: string }) {
  return <span className="skeleton" style={{ width }} aria-hidden="true" />;
}

/** Toont een waarde, of een laadbalkje zolang ze er nog niet is. */
export function Value({ children, loading, width }: { children: ReactNode; loading: boolean; width?: string }) {
  return loading ? <Skeleton width={width} /> : <>{children}</>;
}

export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Een statuslabel met een gekleurd bolletje: groen (in orde), grijs (bezig), rood (probleem). */
export function State({ state, children }: { state: "ok" | "wait" | "bad"; children: ReactNode }) {
  return <span className={`state ${state === "wait" ? "" : state}`}>{children}</span>;
}

export function Address({ value, chars = 4 }: { value: string; chars?: number }) {
  const { lang } = useLang();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* klembord niet beschikbaar: het adres blijft selecteerbaar */
    }
  };
  return (
    <span className="address">
      <a className="mono" href={explorerAddress(value)} target="_blank" rel="noreferrer" title={value}>
        {shortAddress(value, chars)}
      </a>
      <button type="button" className="copy" onClick={copy} aria-label={`${lang === "nl" ? "Kopieer" : "Copy"} ${value}`}>
        {copied ? (lang === "nl" ? "Gekopieerd" : "Copied") : lang === "nl" ? "Kopieer" : "Copy"}
      </button>
    </span>
  );
}

/** Laat een blok rustig verschijnen als het in beeld komt (niet bij "minder beweging"). */
export function Reveal({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  const Comp = Tag as "div";
  return (
    <Comp ref={ref as RefObject<HTMLDivElement>} className={`reveal${inView ? " in" : ""} ${className}`.trim()}>
      {children}
    </Comp>
  );
}

export { explorerAddress };
