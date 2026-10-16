// Inloggen met een Solana-wallet (Phantom, Solflare, Backpack, ...), in het Engels of Nederlands.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { isTestnet, network } from "../config";
import { shortAddress } from "../lib/format";
import { useT } from "../i18n";

const T = {
  en: {
    title: "Sign in with your wallet",
    intro: "Your wallet is your login. We never ask for your secret phrase.",
    found: "detected",
    connecting: "connecting…",
    none: "No wallet found in this browser.",
    openIn: (w: string) => `Open in the ${w} app`,
    install: (w: string) => `Install ${w}`,
    recommended: "recommended",
    devnet: `Demo on Solana ${network === "localnet" ? "localnet" : "devnet"}. In Phantom: Settings › Developer settings › Testnet mode.`,
    close: "Close",
    signIn: "Sign in",
    myPass: "My pass",
    claim: "Claim a pass",
    signOut: "Sign out",
  },
  nl: {
    title: "Inloggen met je wallet",
    intro: "Je wallet is je login. We vragen nooit je geheime zin.",
    found: "gevonden",
    connecting: "verbinden…",
    none: "Geen wallet gevonden in deze browser.",
    openIn: (w: string) => `Openen in de ${w}-app`,
    install: (w: string) => `${w} installeren`,
    recommended: "aanbevolen",
    devnet: `Demo op het Solana-${network === "localnet" ? "localnet" : "testnet (devnet)"}. In Phantom: Instellingen › Ontwikkelaarsinstellingen › Testnetmodus.`,
    close: "Sluiten",
    signIn: "Inloggen",
    myPass: "Mijn pass",
    claim: "Pass claimen",
    signOut: "Uitloggen",
  },
};

type WalletUi = { open: () => void };
const WalletUiContext = createContext<WalletUi>({ open: () => {} });

export function useWalletUi() {
  return useContext(WalletUiContext);
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function WalletUiProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const value = useMemo(() => ({ open: () => setVisible(true) }), []);
  return (
    <WalletUiContext.Provider value={value}>
      {children}
      {visible && <WalletModal onClose={() => setVisible(false)} />}
    </WalletUiContext.Provider>
  );
}

function WalletModal({ onClose }: { onClose: () => void }) {
  const t = useT(T);
  const { wallets, select, connected, connecting } = useWallet();
  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (connected) onClose();
  }, [connected, onClose]);

  const here = typeof window !== "undefined" ? window.location.href : "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="wallet-title">{t.title}</h2>
          <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label={t.close}>×</button>
        </div>
        <p className="muted" style={{ fontSize: 15 }}>{t.intro}</p>

        {installed.length > 0 ? (
          <ul className="wallet-list">
            {installed.map((w) => (
              <li key={w.adapter.name}>
                <button type="button" className="wallet-option" disabled={connecting} onClick={() => select(w.adapter.name as WalletName)}>
                  <img src={w.adapter.icon} alt="" />
                  {w.adapter.name}
                  <small>{connecting ? t.connecting : t.found}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ fontSize: 15 }}>{t.none}</p>
            <ul className="wallet-list">
              {isMobile() ? (
                <>
                  <li><a className="wallet-option" href={`https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(origin)}`}>{t.openIn("Phantom")} <small>{t.recommended}</small></a></li>
                  <li><a className="wallet-option" href={`https://solflare.com/ul/v1/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(origin)}`}>{t.openIn("Solflare")}</a></li>
                </>
              ) : (
                <>
                  <li><a className="wallet-option" href="https://phantom.com/download" target="_blank" rel="noreferrer">{t.install("Phantom")} <small>{t.recommended}</small></a></li>
                  <li><a className="wallet-option" href="https://solflare.com/download" target="_blank" rel="noreferrer">{t.install("Solflare")}</a></li>
                  <li><a className="wallet-option" href="https://backpack.app/download" target="_blank" rel="noreferrer">{t.install("Backpack")}</a></li>
                </>
              )}
            </ul>
          </div>
        )}

        {isTestnet && <p className="notice">{t.devnet}</p>}
      </div>
    </div>
  );
}

export function AccountButton() {
  const t = useT(T);
  const { publicKey, disconnect, connecting } = useWallet();
  const { open } = useWalletUi();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  if (!publicKey) {
    return (
      <button type="button" className="account-btn" onClick={open} disabled={connecting}>
        {connecting ? t.connecting : t.signIn}
      </button>
    );
  }
  return (
    <div className="account" ref={ref}>
      <button type="button" className="account-btn mono" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
        {shortAddress(publicKey.toBase58())}
      </button>
      {menu && (
        <div className="account-pop">
          <Link to="/mijn-pass" onClick={() => setMenu(false)}>{t.myPass}</Link>
          <Link to="/genesis" onClick={() => setMenu(false)}>{t.claim}</Link>
          <button type="button" onClick={() => { setMenu(false); void disconnect(); }}>{t.signOut}</button>
        </div>
      )}
    </div>
  );
}
