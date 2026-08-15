import { useEffect, useState } from "react";
import {
  recupererTicket,
  mettreAJourTicketDirect,
  supprimerTicketDirect,
  recupererPlansTest,
  lierPlanTestDirect,
  delierPlanTestDirect,
  executerCasTestDirect,
  supprimerCasTestDirect,
  type TicketDetailComplet,
  type PlanTestResume,
} from "../lib/api";
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
  const [plansDisponibles, setPlansDisponibles] = useState<PlanTestResume[]>([]);
  const [planALier, setPlanALier] = useState("");
  const [liaisonEnCours, setLiaisonEnCours] = useState(false);

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
    recupererPlansTest()
      .then((r) => setPlansDisponibles(r.plans))
      .catch(() => setPlansDisponibles([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function supprimer() {
    if (!ticket) return;
    if (!confirm(`Supprimer le ticket « ${ticket.titre} » ?`)) return;
    try {
      await supprimerTicketDirect(id);
      onRetour();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function lierPlan() {
    if (!planALier) return;
    setLiaisonEnCours(true);
    try {
      await lierPlanTestDirect(id, planALier);
      setPlanALier("");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setLiaisonEnCours(false);
    }
  }

  async function delierPlan(planId: string) {
    try {
      await delierPlanTestDirect(id, planId);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function executerCas(casId: string, statut: "a_faire" | "reussi" | "echoue") {
    try {
      await executerCasTestDirect(casId, { statut });
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function supprimerCas(casId: string) {
    if (!confirm("Supprimer ce scénario ?")) return;
    try {
      await supprimerCasTestDirect(casId);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  const plansLies = new Set(ticket?.plans_test.map((p) => p.id) ?? []);
  const plansALier = plansDisponibles.filter((p) => !plansLies.has(p.id));

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
                <button className="sidebar__nouvelle sidebar__nouvelle--danger" onClick={supprimer}>
                  Supprimer
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
            <div className="constats-groupe__titre-ligne">
              <div className="constats-groupe__titre">Plans de test liés</div>
              {plansALier.length > 0 && (
                <div style={{ display: "flex", gap: "var(--e-2)" }}>
                  <select value={planALier} onChange={(e) => setPlanALier(e.target.value)}>
                    <option value="">Lier un plan existant…</option>
                    {plansALier.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                  <button className="btn" onClick={lierPlan} disabled={!planALier || liaisonEnCours}>
                    Lier
                  </button>
                </div>
              )}
            </div>
            {ticket.plans_test.length === 0 && (
              <div className="etat-vide">Aucun plan de test lié à ce ticket.</div>
            )}
            {ticket.plans_test.map((plan) => (
              <div className="plan-test" key={plan.id}>
                <div
                  className="plan-test__nom"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  {plan.nom}
                  <button className="btn" onClick={() => delierPlan(plan.id)}>
                    Délier
                  </button>
                </div>
                <div className="liste">
                  {plan.cas.map((c) => (
                    <div className="ligne" key={c.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <div className="ligne__corps">
                        <span className={badgeStatutCas(c.statut)}>{c.statut.replace("_", " ")}</span>
                        <span className="ligne__resume">{c.etape}</span>
                        {c.executee_par && (
                          <span className="main__soustitre" style={{ marginLeft: "auto" }}>
                            par {c.executee_par}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "var(--e-1)", marginTop: "var(--e-1)", flexWrap: "wrap" }}>
                        <button className="btn" onClick={() => executerCas(c.id, "reussi")}>
                          Réussi
                        </button>
                        <button className="btn" onClick={() => executerCas(c.id, "echoue")}>
                          Échoué
                        </button>
                        <button className="btn" onClick={() => executerCas(c.id, "a_faire")}>
                          À faire
                        </button>
                        <button className="btn btn--danger" onClick={() => supprimerCas(c.id)}>
                          Supprimer
                        </button>
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
