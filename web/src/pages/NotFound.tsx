import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container page-body narrow" style={{ textAlign: "center", justifyItems: "center" }}>
      <h1 style={{ fontSize: "2.4rem" }}>Deze pagina bestaat niet</h1>
      <p className="muted">Misschien zocht je je portefeuille of de live controles.</p>
      <div className="hero-ctas" style={{ justifyContent: "center" }}>
        <Link className="btn" to="/">Naar het overzicht</Link>
        <Link className="btn btn-ghost" to="/transparantie">Transparantie</Link>
      </div>
    </div>
  );
}
