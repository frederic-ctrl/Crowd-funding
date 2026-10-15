import { useState, type ReactNode } from "react";
import { explorerAddress } from "../lib/explorer";
import { shortAddress } from "../lib/format";

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="#2f5bea" />
      <path d="M6 12 H 18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 8 H 13" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 16 H 15" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ScanLines() {
  return (
    <div className="scanlines" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export function Skeleton({ width = "6ch" }: { width?: string }) {
  return <span className="skeleton" style={{ width }} aria-hidden="true" />;
}

/** Toont een waarde, of een laadbalkje zolang ze er nog niet is. */
export function Value({ children, loading, width }: { children: ReactNode; loading: boolean; width?: string }) {
  return loading ? <Skeleton width={width} /> : <>{children}</>;
}

export function Address({ value, chars = 4, link = true }: { value: string; chars?: number; link?: boolean }) {
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
      {link ? (
        <a href={explorerAddress(value)} target="_blank" rel="noreferrer" title={value}>
          {shortAddress(value, chars)}
        </a>
      ) : (
        <span title={value}>{shortAddress(value, chars)}</span>
      )}
      <button type="button" className="copy" onClick={copy} aria-label={`Kopieer adres ${value}`}>
        {copied ? "gekopieerd" : "kopieer"}
      </button>
    </span>
  );
}

export function Progress({ value, max, goal, labels, onPaper = false }: { value: number; max: number; goal?: number; labels?: [ReactNode, ReactNode]; onPaper?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const goalPct = goal && max > 0 ? Math.min(100, (goal / max) * 100) : null;
  return (
    <div className={`progress${onPaper ? " on-paper" : ""}`}>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
        {goalPct !== null && <div className="progress-goal" style={{ left: `${goalPct}%` }} title="Minimumdoel" />}
      </div>
      {labels && (
        <div className="progress-labels">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

type CheckState = "ok" | "wait" | "bad";

export function Check({ state, title, children, link }: { state: CheckState; title: ReactNode; children?: ReactNode; link?: { href: string; label: string } }) {
  const icon = state === "ok" ? "✓" : state === "bad" ? "!" : "…";
  return (
    <li className={`check check-${state}`}>
      <span className="check-icon" aria-hidden="true">{icon}</span>
      <div className="check-body">
        <h3>{title}</h3>
        {children && <p>{children}</p>}
      </div>
      {link && (
        <a className="check-link" href={link.href} target="_blank" rel="noreferrer">
          {link.label}
        </a>
      )}
    </li>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    open: ["status-open", "Open"],
    gepland: ["status-plan", "Gepland"],
    gesloten: ["status-plan", "Gesloten"],
    afgerond: ["status-open", "Afgerond"],
  };
  const [cls, label] = map[status] ?? ["status-plan", status];
  return <span className={`status ${cls}`}>{label}</span>;
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export { explorerAddress };
