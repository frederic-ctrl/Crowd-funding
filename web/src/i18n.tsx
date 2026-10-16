// Taal van de site: Engels of Nederlands. Volgorde: ?lang= in de link, dan de vorige keuze,
// dan de taal van de browser (Nederlands als die met "nl" begint, anders Engels).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setLocale } from "./lib/format";
import { setApiLang } from "./lib/api";

export type Lang = "en" | "nl";

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

function initialLang(): Lang {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl === "en" || fromUrl === "nl") return fromUrl;
    const saved = window.localStorage.getItem("lang");
    if (saved === "en" || saved === "nl") return saved;
  } catch {
    /* geen opslag beschikbaar: val terug op de browser */
  }
  return navigator.language?.toLowerCase().startsWith("nl") ? "nl" : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  setLocale(lang);
  setApiLang(lang);

  useEffect(() => {
    document.documentElement.lang = lang === "nl" ? "nl-BE" : "en";
    try {
      window.localStorage.setItem("lang", lang);
    } catch {
      /* niet erg: de keuze geldt dan enkel voor dit bezoek */
    }
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang: setLangState }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** Kies de teksten van de huidige taal uit een woordenboek { en: {...}, nl: {...} }. */
export function useT<T>(dict: Record<Lang, T>): T {
  return dict[useLang().lang];
}
