// Inloggen met een Solana-wallet (Phantom, Solflare, Backpack, ...), in het Nederlands.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { isTestnet, network } from "../config";
import { shortAddress } from "../lib/format";

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
          <h2 id="wallet-title" style={{ fontSize: "1.4rem" }}>Inloggen met je wallet</h2>
          <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label="Sluiten">×</button>
        </div>
        <p className="muted" style={{ fontSize: "0.95rem" }}>
          Je wallet is je login. We vragen nooit je geheime zin of wachtwoord.
        </p>

        {installed.length > 0 ? (
          <ul className="wallet-list">
            {installed.map((w) => (
              <li key={w.adapter.name}>
                <button type="button" className="wallet-option" disabled={connecting} onClick={() => select(w.adapter.name as WalletName)}>
                  <img src={w.adapter.icon} alt="" />
                  {w.adapter.name}
                  <small>{connecting ? "verbinden..." : "gevonden"}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ fontSize: "0.95rem" }}>Geen wallet gevonden in deze browser.</p>
            {isMobile() ? (
              <ul className="wallet-list">
                <li>
                  <a className="wallet-option" href={`https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(origin)}`}>
                    Openen in de Phantom-app <small>aanbevolen</small>
                  </a>
                </li>
                <li>
                  <a className="wallet-option" href={`https://solflare.com/ul/v1/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(origin)}`}>
                    Openen in de Solflare-app
                  </a>
                </li>
              </ul>
            ) : (
              <ul className="wallet-list">
                <li><a className="wallet-option" href="https://phantom.com/download" target="_blank" rel="noreferrer">Phantom installeren <small>aanbevolen</small></a></li>
                <li><a className="wallet-option" href="https://solflare.com/download" target="_blank" rel="noreferrer">Solflare installeren</a></li>
                <li><a className="wallet-option" href="https://backpack.app/download" target="_blank" rel="noreferrer">Backpack installeren</a></li>
              </ul>
            )}
          </div>
        )}

        {isTestnet && (
          <p className="notice notice-info">
            <strong>Testnet-demo.</strong> Zet je wallet op {network === "localnet" ? "localnet" : "Devnet"}. In Phantom: Instellingen › Ontwikkelaarsinstellingen › Testnetmodus.
          </p>
        )}
      </div>
    </div>
  );
}

export function AccountButton({ compact = false }: { compact?: boolean }) {
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
      <button type="button" className={`btn ${compact ? "btn-small" : ""}`} onClick={open} disabled={connecting}>
        {connecting ? "Verbinden..." : "Inloggen"}
      </button>
    );
  }
  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="btn btn-small btn-ghost on-night" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
        <span className="mono">{shortAddress(publicKey.toBase58())}</span>
      </button>
      {menu && (
        <div className="account-pop">
          <Link to="/portefeuille" onClick={() => setMenu(false)}>Mijn portefeuille</Link>
          <Link to="/investeren" onClick={() => setMenu(false)}>Investeren</Link>
          <button type="button" onClick={() => { setMenu(false); void disconnect(); }}>Uitloggen</button>
        </div>
      )}
    </div>
  );
}
