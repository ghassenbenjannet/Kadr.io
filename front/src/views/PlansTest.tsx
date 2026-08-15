import { useEffect, useState } from "react";
import {
  recupererPlansTest,
  recupererPlanTest,
  creerPlanTestDirect,
  supprimerPlanTestDirect,
  ajouterCasTestDirect,
  executerCasTestDirect,
  supprimerCasTestDirect,
  delierPlanTestDirect,
  type PlanTestResume,
  type PlanTestComplet,
} from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";
import { badgeStatutCas } from "../lib/tickets-libelles";

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function PlanTestDetailVue({ id, onRetour, onSupprime }: { id: string; onRetour: () => void; onSupprime: () => void }) {
  const [plan, setPlan] = useState<PlanTestComplet | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [nouvelleEtape, setNouvelleEtape] = useState("");
  const [nouveauResultat, setNouveauResultat] = useState("");
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  function charger() {
    setErreur(null);
    return recupererPlanTest(id)
      .then((r) => setPlan(r))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    setPlan(null);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function executer(casId: string, statut: "a_faire" | "reussi" | "echoue") {
    try {
      await executerCasTestDirect(casId, { statut });
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function supprimerCas(casId: string) {
    if (!confirm("Supprimer ce scénario ?")) return;
    try {
      await supprimerCasTestDirect(casId);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function ajouterScenario() {
    if (!nouvelleEtape.trim() || !nouveauResultat.trim()) return;
    setAjoutEnCours(true);
    try {
      await ajouterCasTestDirect(id, { etape: nouvelleEtape.trim(), resultat_attendu: nouveauResultat.trim() });
      setNouvelleEtape("");
      setNouveauResultat("");
      setAjoutOuvert(false);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function delier(ticketId: string) {
    try {
      await delierPlanTestDirect(ticketId, id);
      charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function supprimerPlan() {
    if (!plan) return;
    if (!confirm(`Supprimer le plan de test « ${plan.nom} » et ses ${plan.cas.length} scénario(s) ?`)) return;
    try {
      await supprimerPlanTestDirect(id);
      onSupprime();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <button className="lien-retour" onClick={onRetour}>
        ← Plans de test
      </button>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && plan === null && <div className="chargement">Chargement…</div>}

      {!erreur && plan !== null && (
        <>
          <div className="main__entete">
            <div className="main__entete-titre">
              <div>
                <h1>{plan.nom}</h1>
                {plan.description && <div className="main__soustitre">{plan.description}</div>}
              </div>
            </div>
            <div className="main__entete-actions">
              <button className="btn btn--danger" onClick={supprimerPlan}>
                Supprimer le plan
              </button>
            </div>
          </div>

          <div className="constats-groupe">
            <div className="constats-groupe__titre-ligne">
              <div className="constats-groupe__titre">Scénarios</div>
              <button className="btn" onClick={() => setAjoutOuvert((v) => !v)}>
                {ajoutOuvert ? "Fermer" : "+ Ajouter un scénario"}
              </button>
            </div>

            {ajoutOuvert && (
              <div className="editeur-fiche" style={{ marginBottom: "var(--e-3)" }}>
                <div className="champ">
                  <label className="champ__label" htmlFor="nouvelle-etape">
                    Étape
                  </label>
                  <input id="nouvelle-etape" value={nouvelleEtape} onChange={(e) => setNouvelleEtape(e.target.value)} />
                </div>
                <div className="champ">
                  <label className="champ__label" htmlFor="nouveau-resultat">
                    Résultat attendu
                  </label>
                  <input
                    id="nouveau-resultat"
                    value={nouveauResultat}
                    onChange={(e) => setNouveauResultat(e.target.value)}
                  />
                </div>
                <div className="editeur-fiche__actions">
                  <button className="btn btn--primaire" onClick={ajouterScenario} disabled={ajoutEnCours}>
                    Ajouter
                  </button>
                </div>
              </div>
            )}

            {plan.cas.length === 0 && <div className="etat-vide">Aucun scénario pour l'instant.</div>}
            {plan.cas.map((c) => (
              <div className="constat" key={c.id}>
                <div className="constat__corps">
                  <div className="constat__resume">{c.etape}</div>
                  <div className="constat__consequence">{c.resultat_attendu}</div>
                  {c.executee_par && (
                    <div className="main__soustitre">
                      {c.statut === "reussi" ? "Réussi" : c.statut === "echoue" ? "Échoué" : "Exécuté"} par{" "}
                      {c.executee_par}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--e-2)", alignItems: "flex-end" }}>
                  <span className={badgeStatutCas(c.statut)}>{c.statut.replace("_", " ")}</span>
                  <div style={{ display: "flex", gap: "var(--e-1)" }}>
                    <button className="btn" onClick={() => executer(c.id, "reussi")}>
                      Réussi
                    </button>
                    <button className="btn" onClick={() => executer(c.id, "echoue")}>
                      Échoué
                    </button>
                    <button className="btn" onClick={() => executer(c.id, "a_faire")}>
                      À faire
                    </button>
                    <button className="btn btn--danger" onClick={() => supprimerCas(c.id)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="constats-groupe">
            <div className="constats-groupe__titre">Tickets liés</div>
            {plan.tickets.length === 0 && (
              <div className="etat-vide">Aucun ticket lié — lie ce plan depuis la fiche d'un ticket.</div>
            )}
            {plan.tickets.length > 0 && (
              <div className="liste">
                {plan.tickets.map((t) => (
                  <div className="ligne" key={t.id}>
                    <div className="ligne__corps">
                      <span className="ligne__resume">
                        {t.projet_nom} / {t.epic_nom} / {t.titre}
                      </span>
                      <button className="btn" style={{ marginLeft: "auto" }} onClick={() => delier(t.id)}>
                        Délier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PlansTest() {
  const [plans, setPlans] = useState<PlanTestResume[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouvelleDescription, setNouvelleDescription] = useState("");
  const [nouveauxCas, setNouveauxCas] = useState<{ etape: string; resultat_attendu: string }[]>([
    { etape: "", resultat_attendu: "" },
  ]);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);

  function charger() {
    setErreur(null);
    return recupererPlansTest()
      .then((r) => setPlans(r.plans))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    charger();
  }, []);

  function majCas(index: number, champ: "etape" | "resultat_attendu", valeur: string) {
    setNouveauxCas((cas) => cas.map((c, i) => (i === index ? { ...c, [champ]: valeur } : c)));
  }

  function ajouterLigneCas() {
    setNouveauxCas((cas) => [...cas, { etape: "", resultat_attendu: "" }]);
  }

  function retirerLigneCas(index: number) {
    setNouveauxCas((cas) => (cas.length > 1 ? cas.filter((_, i) => i !== index) : cas));
  }

  async function creer() {
    if (!nouveauNom.trim()) {
      setErreurCreation("« Nom » est requis.");
      return;
    }
    const cas = nouveauxCas
      .map((c) => ({ etape: c.etape.trim(), resultat_attendu: c.resultat_attendu.trim() }))
      .filter((c) => c.etape && c.resultat_attendu);
    if (cas.length === 0) {
      setErreurCreation("Au moins un scénario (étape + résultat attendu) est requis.");
      return;
    }
    setCreationEnCours(true);
    setErreurCreation(null);
    try {
      const r = await creerPlanTestDirect({
        nom: nouveauNom.trim(),
        description: nouvelleDescription.trim() || undefined,
        cas,
      });
      setCreationOuverte(false);
      setNouveauNom("");
      setNouvelleDescription("");
      setNouveauxCas([{ etape: "", resultat_attendu: "" }]);
      setSelection(r.id);
    } catch (e) {
      setErreurCreation(e instanceof Error ? e.message : String(e));
    } finally {
      setCreationEnCours(false);
    }
  }

  if (selection) {
    return (
      <PlanTestDetailVue
        id={selection}
        onRetour={() => {
          setSelection(null);
          charger();
        }}
        onSupprime={() => {
          setSelection(null);
          charger();
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader groupe="Projets" titre="Plans de test">
        <button className="btn btn--primaire" onClick={() => setCreationOuverte((v) => !v)}>
          {creationOuverte ? "Fermer" : "+ Nouveau plan"}
        </button>
        <ActionsGlobales />
      </PageHeader>

      {creationOuverte && (
        <div className="editeur-fiche">
          <div className="champ">
            <label className="champ__label" htmlFor="plan-nom">
              Nom
            </label>
            <input id="plan-nom" value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} />
          </div>
          <div className="champ">
            <label className="champ__label" htmlFor="plan-description">
              Description
            </label>
            <input
              id="plan-description"
              value={nouvelleDescription}
              onChange={(e) => setNouvelleDescription(e.target.value)}
            />
          </div>

          <div className="champ__label">Scénarios</div>
          {nouveauxCas.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: "var(--e-2)", marginBottom: "var(--e-2)" }}>
              <input
                placeholder="Étape"
                value={c.etape}
                onChange={(e) => majCas(i, "etape", e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                placeholder="Résultat attendu"
                value={c.resultat_attendu}
                onChange={(e) => majCas(i, "resultat_attendu", e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn" onClick={() => retirerLigneCas(i)} disabled={nouveauxCas.length === 1}>
                ✕
              </button>
            </div>
          ))}
          <button className="btn" onClick={ajouterLigneCas} style={{ marginBottom: "var(--e-3)" }}>
            + Ajouter une ligne
          </button>

          {erreurCreation && <div className="champ__erreur">{erreurCreation}</div>}
          <div className="editeur-fiche__actions">
            <button className="btn btn--primaire" onClick={creer} disabled={creationEnCours}>
              Créer
            </button>
            <button className="btn" onClick={() => setCreationOuverte(false)} disabled={creationEnCours}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && plans === null && <div className="chargement">Chargement…</div>}
      {!erreur && plans !== null && plans.length === 0 && !creationOuverte && (
        <div className="etat-vide">Aucun plan de test pour l'instant.</div>
      )}
      {!erreur && plans !== null && plans.length > 0 && (
        <div className="liste">
          {plans.map((p) => (
            <button className="ligne ligne--cliquable" key={p.id} onClick={() => setSelection(p.id)}>
              <div className="ligne__corps">
                <span className="ligne__resume">{p.nom}</span>
                <span className="main__soustitre" style={{ marginLeft: "auto" }}>
                  {p.cas_reussis}/{p.cas_total} réussis
                  {p.cas_echoues > 0 ? ` · ${p.cas_echoues} échoué${p.cas_echoues === 1 ? "" : "s"}` : ""} ·{" "}
                  {formaterDate(p.cree_le)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
