import { useState, type FormEvent } from "react";
import { seConnecter } from "../lib/api";

export function Login({ onConnecte }: { onConnecte: () => void }) {
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await seConnecter(motDePasse);
      onConnecte();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur de connexion.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="page-connexion">
      <form className="carte-connexion" onSubmit={soumettre}>
        <div className="carte-connexion__titre">
          <span className="sidebar__nom">Registre SI</span>
          <span className="sidebar__baseline">Abraxio</span>
        </div>
        <div className="champ">
          <label className="champ__label" htmlFor="mot-de-passe">
            Mot de passe
          </label>
          <input
            id="mot-de-passe"
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoFocus
            required
          />
        </div>
        {erreur && <div className="champ__erreur">{erreur}</div>}
        <button className="btn btn--primaire" type="submit" disabled={enCours || !motDePasse}>
          {enCours ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
