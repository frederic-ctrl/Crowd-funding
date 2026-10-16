import { Link } from "react-router-dom";
import { useT } from "../i18n";

const T = {
  en: { title: "This page doesn’t exist.", text: "Maybe you were looking for your pass or the live checks.", home: "Go home", trans: "Transparency" },
  nl: { title: "Deze pagina bestaat niet.", text: "Misschien zocht je je pass of de live controles.", home: "Naar het overzicht", trans: "Transparantie" },
};

export default function NotFound() {
  const t = useT(T);
  return (
    <header className="page-head" style={{ paddingBottom: 120 }}>
      <div className="container">
        <h1>{t.title}</h1>
        <p>{t.text}</p>
        <div className="hero-ctas">
          <Link className="btn" to="/">{t.home}</Link>
          <Link className="more" to="/transparantie">{t.trans}</Link>
        </div>
      </div>
    </header>
  );
}
