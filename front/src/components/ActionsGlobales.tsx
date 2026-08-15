import { useState } from "react";
import { lancerControlesDirect } from "../lib/api";
import { naviguerVersNouvelleEntree } from "../lib/navigation";

/** Les deux actions présentes sur l'en-tête de chaque page : lancer la vigie, créer une entrée. */
export function ActionsGlobales() {
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function lancer() {
    setEnCours(true);
    setMessage(null);
    try {
      const r = await lancerControlesDirect();
      setMessage(
        r.nouveaux === 0 && r.resolus === 0
          ? "Aucun changement."
          : `${r.nouveaux} nouveau${r.nouveaux === 1 ? "" : "x"}, ${r.resolus} traité${r.resolus === 1 ? "" : "s"}.`
      );
      setTimeout(() => setMessage(null), 3500);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="actions-globales">
      {message && <span className="actions-globales__message">{message}</span>}
      <button className="btn" onClick={lancer} disabled={enCours}>
        {enCours ? "Contrôles…" : "Lancer les contrôles"}
      </button>
      <button className="btn btn--primaire" onClick={() => naviguerVersNouvelleEntree()}>
        Nouvelle entrée
      </button>
    </div>
  );
}
