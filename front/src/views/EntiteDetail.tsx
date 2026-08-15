import { useEffect, useState } from "react";
import { recupererEntiteJournal } from "../lib/api";
import { libelleChamp } from "../lib/outils-libelles";

const CHAMPS_PAR_ENTITE: Record<string, string[]> = {
  demande: [
    "demandeur",
    "equipe",
    "expression_brute",
    "reformulation",
    "type",
    "priorite",
    "priorite_arbitree_par",
    "statut",
    "cree_le",
    "maj_le",
  ],
  decision: ["contexte", "options", "decision", "decideur", "consequences", "statut", "remplacee_par", "cree_le", "maj_le"],
  changement: [
    "description",
    "perimetre",
    "type",
    "rollback",
    "test_effectue",
    "communication",
    "demande_id",
    "decision_id",
    "cree_le",
    "maj_le",
  ],
  incident: [
    "symptome",
    "impact",
    "cause",
    "changement_id",
    "resolution",
    "resolu_le",
    "action_preventive",
    "cree_le",
    "maj_le",
  ],
};

const TITRES_ENTITE: Record<string, string> = {
  demande: "Demande",
  decision: "Décision",
  changement: "Changement",
  incident: "Incident",
};

function formaterValeur(cle: string, valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "";
  if (cle === "cree_le" || cle === "maj_le" || cle === "resolu_le") {
    const d = new Date(String(valeur));
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return String(valeur);
}

export function EntiteDetail({
  entite,
  id,
  onRetour,
}: {
  entite: string;
  id: string;
  onRetour: () => void;
}) {
  const [donnees, setDonnees] = useState<Record<string, unknown> | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setDonnees(null);
    setErreur(null);
    recupererEntiteJournal(entite, id)
      .then((r) => {
        if (!annule) setDonnees(r);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      });
    return () => {
      annule = true;
    };
  }, [entite, id]);

  const champs = CHAMPS_PAR_ENTITE[entite] ?? [];

  return (
    <div>
      <button className="lien-retour" onClick={onRetour}>
        ← Retour
      </button>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && donnees === null && <div className="chargement">Chargement…</div>}

      {!erreur && donnees !== null && (
        <>
          <div className="main__entete">
            <div className="main__entete-titre">
              <span className="page-icone" aria-hidden="true">
                ☰
              </span>
              <div>
                <h1>{TITRES_ENTITE[entite] ?? entite}</h1>
              </div>
            </div>
          </div>

          <dl className="fiche">
            {champs.map((cle) => {
              const valeur = donnees[cle];
              if (cle === "options" && Array.isArray(valeur)) {
                if (valeur.length === 0) return null;
                return (
                  <div className="fiche__ligne" key={cle}>
                    <dt>{libelleChamp(cle)}</dt>
                    <dd>
                      <ul className="fiche__options">
                        {(valeur as { option: string; ecartee_car?: string }[]).map((o, i) => (
                          <li key={i}>
                            <strong>{o.option}</strong>
                            {o.ecartee_car ? ` — écartée : ${o.ecartee_car}` : " — retenue"}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                );
              }
              const texte = formaterValeur(cle, valeur);
              if (!texte) return null;
              return (
                <div className="fiche__ligne" key={cle}>
                  <dt>{libelleChamp(cle)}</dt>
                  <dd>{texte}</dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
    </div>
  );
}
