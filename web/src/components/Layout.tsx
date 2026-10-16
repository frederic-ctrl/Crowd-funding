import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { company, isTestnet } from "../config";
import { useLang, useT, type Lang } from "../i18n";
import { LogoMark } from "./ui";
import { AccountButton } from "./Wallet";

const T = {
  en: {
    nav: [
      { to: "/genesis", label: "Genesis Pass" },
      { to: "/mijn-pass", label: "My pass" },
      { to: "/transparantie", label: "Transparency" },
    ],
    skip: "Skip to content",
    menu: "Menu",
    ribbon: "This is a demo on Solana devnet. Not on sale yet.",
    ribbonMore: "How it works",
    footerNote: isTestnet
      ? "Marketing Scan Genesis is a demo on Solana devnet. Passes and test euros have no value. Not on sale yet: real sales start once the legal setup is done."
      : "Marketing Scan Genesis is an early-access sale of lifetime subscriptions to Marketing Scan Pro. Not an investment: passes are non-transferable and earn nothing.",
    cols: [
      { title: "Genesis", links: [["/genesis", "Genesis Pass"], ["/mijn-pass", "My pass"], ["/transparantie", "Transparency"]] },
      { title: "Marketing Scan", links: [["https://www.marketingscan.be", "Free marketing scan"], ["/#faq", "Questions"]] },
      { title: "Legal", links: [["/voorwaarden", "Terms"], ["/privacy", "Privacy"]] },
    ],
    legal: (year: number) => `Copyright © ${year} ${company.merk}.`,
    entity: company.vennootschap ? `${company.vennootschap}, ${company.adres}, ${company.ondernemingsnummer}.` : "Company details are published before sales start.",
  },
  nl: {
    nav: [
      { to: "/genesis", label: "Genesis Pass" },
      { to: "/mijn-pass", label: "Mijn pass" },
      { to: "/transparantie", label: "Transparantie" },
    ],
    skip: "Naar de inhoud",
    menu: "Menu",
    ribbon: "Dit is een demo op het Solana-testnet. Nog geen verkoop.",
    ribbonMore: "Hoe het werkt",
    footerNote: isTestnet
      ? "Marketing Scan Genesis is een demo op het Solana-testnet. Passes en test-euro hebben geen waarde. Nog geen verkoop: die start pas als de juridische vorm in orde is."
      : "Marketing Scan Genesis is een voorverkoop van levenslange abonnementen op Marketing Scan Pro. Geen investering: passes zijn niet overdraagbaar en leveren niets op.",
    cols: [
      { title: "Genesis", links: [["/genesis", "Genesis Pass"], ["/mijn-pass", "Mijn pass"], ["/transparantie", "Transparantie"]] },
      { title: "Marketing Scan", links: [["https://www.marketingscan.be", "Gratis marketingscan"], ["/#faq", "Vragen"]] },
      { title: "Juridisch", links: [["/voorwaarden", "Voorwaarden"], ["/privacy", "Privacy"]] },
    ],
    legal: (year: number) => `Copyright © ${year} ${company.merk}.`,
    entity: company.vennootschap ? `${company.vennootschap}, ${company.adres}, ${company.ondernemingsnummer}.` : "De bedrijfsgegevens verschijnen vóór de start van de verkoop.",
  },
};

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);
  return null;
}

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <span className="lang" role="group" aria-label="Language">
      {(["en", "nl"] as Lang[]).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}

function SmartLink({ to, children }: { to: string; children: ReactNode }) {
  return to.startsWith("http") ? <a href={to}>{children}</a> : <Link to={to}>{children}</Link>;
}

export function Layout({ children }: { children: ReactNode }) {
  const t = useT(T);
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenu(false), [pathname]);

  return (
    <>
      <ScrollToTop />
      <a href="#inhoud" className="skip-link">{t.skip}</a>
      <header className="nav">
        <div className="container wide nav-inner">
          <Link className="brand" to="/" aria-label="Marketing Scan Genesis">
            <LogoMark size={22} />
            <span>Marketing Scan</span>
          </Link>
          <nav className="nav-links" aria-label="Genesis">
            {t.nav.map((n) => (
              <NavLink key={n.to} to={n.to}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            <LangSwitch />
            <AccountButton />
          </div>
          <button type="button" className="menu-btn" aria-expanded={menu} aria-label={t.menu} onClick={() => setMenu((m) => !m)}>
            <span /><span />
          </button>
        </div>
      </header>
      {menu && (
        <nav className="menu" aria-label={t.menu}>
          {t.nav.map((n) => (
            <Link key={n.to} to={n.to}>{n.label}</Link>
          ))}
          <LangSwitch />
        </nav>
      )}
      {isTestnet && (
        <p className="ribbon">
          {t.ribbon} <Link to="/#hoe">{t.ribbonMore} ›</Link>
        </p>
      )}
      <main id="inhoud">{children}</main>
      <footer className="footer">
        <div className="container wide">
          <p className="footer-top">{t.footerNote}</p>
          <div className="footer-cols">
            {t.cols.map((c) => (
              <div key={c.title}>
                <strong>{c.title}</strong>
                {c.links.map(([to, label]) => (
                  <SmartLink key={to} to={to}>{label}</SmartLink>
                ))}
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <span>{t.legal(new Date().getFullYear())} {t.entity}</span>
            <LangSwitch />
          </div>
        </div>
      </footer>
    </>
  );
}
