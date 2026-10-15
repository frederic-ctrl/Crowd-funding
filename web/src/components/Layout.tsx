import { useEffect, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { company, isTestnet, network } from "../config";
import { LogoMark } from "./ui";
import { AccountButton } from "./Wallet";

const NAV = [
  { to: "/", label: "Overzicht", end: true },
  { to: "/investeren", label: "Investeren" },
  { to: "/portefeuille", label: "Mijn portefeuille" },
  { to: "/transparantie", label: "Transparantie" },
];

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);
  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <ScrollToTop />
      <a href="#inhoud" className="skip-link">Naar de inhoud</a>
      <header className="topbar">
        <div className="container">
          <div className="topbar-inner">
            <Link className="brand" to="/" aria-label="Marketing Scan community-ronde, overzicht">
              <LogoMark />
              <span className="brand-name">Marketing Scan</span>
              <span className="brand-sub">Community-ronde</span>
            </Link>
            <nav className="topnav" aria-label="Hoofdmenu">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>
              ))}
            </nav>
            <div className="topbar-actions">
              {isTestnet && <span className="net-badge" title={`Netwerk: ${network}`}>Testnet</span>}
              <AccountButton compact />
            </div>
          </div>
          <nav className="mobile-nav" aria-label="Hoofdmenu (mobiel)">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="inhoud">{children}</main>
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <p className="footer-name"><span className="dot" aria-hidden="true" />Marketing Scan</p>
          <p>
            {isTestnet
              ? "Dit is een demo op het Solana-testnet. De tokens en de test-euro hebben geen waarde. Er is nog geen aanbod: de echte ronde start pas na de oprichting van de vennootschap en de publicatie van de documenten."
              : "Investeren houdt risico's in: je kan je volledige inleg verliezen. Lees de documenten voor je instapt."}
          </p>
        </div>
        <nav className="footer-links" aria-label="Community-ronde">
          <strong>Community-ronde</strong>
          <Link to="/investeren">Investeren</Link>
          <Link to="/portefeuille">Mijn portefeuille</Link>
          <Link to="/transparantie">Transparantie</Link>
        </nav>
        <nav className="footer-links" aria-label="Meer">
          <strong>Meer</strong>
          <a href={company.website ?? "https://www.marketingscan.be"}>Gratis marketingscan</a>
          <Link to="/privacy">Privacy</Link>
          <Link to="/#risicos">Risico's</Link>
        </nav>
        <p className="footer-legal">
          © 2026 {company.merk}.{" "}
          {company.vennootschap
            ? `${company.vennootschap}, ${company.adres}, ondernemingsnummer ${company.ondernemingsnummer}.`
            : "De vennootschapsgegevens worden gepubliceerd vóór de start van de echte ronde."}
        </p>
      </div>
    </footer>
  );
}
