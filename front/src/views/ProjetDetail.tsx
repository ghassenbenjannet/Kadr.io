import { useEffect, useState } from "react";
import { recupererProjet, type ProjetDetailComplet } from "../lib/api";

const LIBELLES_TYPE_TICKET: Record<string, string> = {
  analyse: "Analyse",
  documentation: "Documentation",
  atelier: "Atelier",
  bug: "Bug",
  task: "Tâche",
};

function badgeStatutTicket(statut: string) {
  if (statut === "bloque") return "badge badge--attention";
  return "badge badge--neutre";
}

function badgeStatutCas(statut: string) {
  if (statut === "reussi") return "badge badge--succes";
  if (statut === "echoue") return "badge badge--danger";
  return "badge badge--neutre";
}

export function ProjetDetail({ id, onRetour }: { id: string; onRetour: () => void }) {
  const [detail, setDetail] = useState<ProjetDetailComplet | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setDetail(null);
    setErreur(null);
    recupererProjet(id)
      .then((r) => {
        if (!annule) setDetail(r);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      });
    return () => {
      annule = true;
    };
  }, [id]);

  return (
    <div>
      <button className="lien-retour" onClick={onRetour}>
        ← Projets
      </button>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && detail === null && <div className="chargement">Chargement…</div>}

      {!erreur && detail !== null && (
        <>
          <div className="main__entete">
            <div className="main__entete-titre">
              <span className="page-icone" aria-hidden="true">
                ▣
              </span>
              <div>
                <h1>{detail.projet.nom}</h1>
                <div className="main__soustitre">
                  {detail.projet.description ?? `Projet ${detail.projet.statut}`}
                </div>
              </div>
            </div>
          </div>

          {detail.epics.length === 0 && (
            <div className="etat-vide">Aucun epic pour l'instant.</div>
          )}
          {detail.epics.map((epic) => (
            <div className="constats-groupe" key={epic.id}>
              <div className="constats-groupe__titre">
                {epic.nom} · {epic.tickets.length} ticket{epic.tickets.length === 1 ? "" : "s"}
              </div>
              <div className="liste">
                {epic.tickets.map((t) => (
                  <div className="ligne" key={t.id}>
                    <div className="ligne__corps">
                      <span className="badge badge--neutre">{LIBELLES_TYPE_TICKET[t.type] ?? t.type}</span>
                      <span className="ligne__resume">{t.titre}</span>
                      <span className={badgeStatutTicket(t.statut)} style={{ marginLeft: "auto" }}>
                        {t.statut.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
                {epic.tickets.length === 0 && <div className="etat-vide">Aucun ticket dans cet epic.</div>}
              </div>
            </div>
          ))}

          <div className="constats-groupe">
            <div className="constats-groupe__titre">Suite de recette</div>
            {detail.suite_recette.length === 0 && (
              <div className="etat-vide">Aucun plan de test lié à un ticket de ce projet.</div>
            )}
            {detail.suite_recette.map((plan) => (
              <div className="plan-test" key={plan.id}>
                <div className="plan-test__nom">{plan.nom}</div>
                <div className="liste">
                  {plan.cas.map((c) => (
                    <div className="ligne" key={c.id}>
                      <div className="ligne__corps">
                        <span className={badgeStatutCas(c.statut)}>{c.statut.replace("_", " ")}</span>
                        <span className="ligne__resume">{c.etape}</span>
                        {c.executee_par && (
                          <span className="main__soustitre" style={{ marginLeft: "auto" }}>
                            par {c.executee_par}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
