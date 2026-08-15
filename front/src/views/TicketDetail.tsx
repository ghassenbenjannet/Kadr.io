import { useEffect, useState } from "react";
import { recupererTicket, mettreAJourTicketDirect, type TicketDetailComplet } from "../lib/api";
import { LIBELLES_TYPE_TICKET, badgeStatutTicket, badgeStatutCas } from "../lib/tickets-libelles";
import { EditeurFiche, type DescripteurChamp } from "../components/EditeurFiche";
import { OPTIONS_STATUT_TICKET } from "../lib/statuts-libelles";

const CHAMPS_MODIFIABLES: DescripteurChamp[] = [
  { cle: "statut", label: "Statut", type: "select", options: OPTIONS_STATUT_TICKET },
  { cle: "description", label: "Description", type: "textarea" },
];

export function TicketDetail({ id, onRetour }: { id: string; onRetour: () => void }) {
  const [ticket, setTicket] = useState<TicketDetailComplet | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState(false);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [enregistrement, setEnregistrement] = useState<"inactif" | "en_cours" | "erreur">("inactif");

  function charger() {
    setErreur(null);
    return recupererTicket(id)
      .then((r) => setTicket(r))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    setTicket(null);
    setEdition(false);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function ouvrirEdition() {
    if (!ticket) return;
    setValeurs({ statut: ticket.statut, description: ticket.description ?? "" });
    setEdition(true);
    setEnregistrement("inactif");
  }

  async function enregistrer() {
    if (!ticket) return;
    const modifies: Record<string, string> = {};
    if (valeurs.statut !== ticket.statut && valeurs.statut) modifies.statut = valeurs.statut;
    if (valeurs.description !== (ticket.description ?? "")) modifies.description = valeurs.description ?? "";
    if (Object.keys(modifies).length === 0) {
      setEdition(false);
      return;
    }
    setEnregistrement("en_cours");
    try {
      await mettreAJourTicketDirect(id, modifies);
      await charger();
      setEdition(false);
      setEnregistrement("inactif");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnregistrement("erreur");
    }
  }

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
            {!edition && (
              <div className="main__entete-actions">
                <button className="sidebar__nouvelle" onClick={ouvrirEdition}>
                  Modifier
                </button>
              </div>
            )}
          </div>

          {edition && (
            <>
              <EditeurFiche
                champs={CHAMPS_MODIFIABLES}
                valeurs={valeurs}
                onChange={(cle, valeur) => setValeurs((v) => ({ ...v, [cle]: valeur }))}
              />
              <div className="editeur-fiche__actions">
                <button className="btn btn--primaire" onClick={enregistrer} disabled={enregistrement === "en_cours"}>
                  Enregistrer
                </button>
                <button className="btn" onClick={() => setEdition(false)} disabled={enregistrement === "en_cours"}>
                  Annuler
                </button>
                {enregistrement === "erreur" && <span className="champ__erreur">Échec de l'enregistrement</span>}
              </div>
            </>
          )}

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
