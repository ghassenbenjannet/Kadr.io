import { useEffect, useState } from "react";
import { recupererTicket, type TicketDetailComplet } from "../lib/api";
import { LIBELLES_TYPE_TICKET, badgeStatutTicket, badgeStatutCas } from "../lib/tickets-libelles";

export function TicketDetail({ id, onRetour }: { id: string; onRetour: () => void }) {
  const [ticket, setTicket] = useState<TicketDetailComplet | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setTicket(null);
    setErreur(null);
    recupererTicket(id)
      .then((r) => {
        if (!annule) setTicket(r);
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
        ← {ticket ? ticket.epic.projet.nom : "Retour"}
      </button>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && ticket === null && <div className="chargement">Chargement…</div>}

      {!erreur && ticket !== null && (
        <>
          <div className="main__entete">
            <div className="main__entete-titre">
              <span className="page-icone" aria-hidden="true">
                ▥
              </span>
              <div>
                <h1>{ticket.titre}</h1>
                <div className="main__soustitre">
                  {ticket.epic.projet.nom} / {ticket.epic.nom}
                </div>
              </div>
            </div>
          </div>

          <dl className="fiche">
            <div className="fiche__ligne">
              <dt>Type</dt>
              <dd>
                <span className="badge badge--neutre">{LIBELLES_TYPE_TICKET[ticket.type] ?? ticket.type}</span>
              </dd>
            </div>
            <div className="fiche__ligne">
              <dt>Statut</dt>
              <dd>
                <span className={badgeStatutTicket(ticket.statut)}>{ticket.statut.replace("_", " ")}</span>
              </dd>
            </div>
            {ticket.description && (
              <div className="fiche__ligne">
                <dt>Description</dt>
                <dd>{ticket.description}</dd>
              </div>
            )}
          </dl>

          <div className="constats-groupe">
            <div className="constats-groupe__titre">Plans de test liés</div>
            {ticket.plans_test.length === 0 && (
              <div className="etat-vide">Aucun plan de test lié à ce ticket.</div>
            )}
            {ticket.plans_test.map((plan) => (
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
