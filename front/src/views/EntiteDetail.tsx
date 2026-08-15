import { useEffect, useState } from "react";
import { recupererEntiteJournal, mettreAJourEntiteDirect, annulerEntiteDirect } from "../lib/api";
import { libelleChamp } from "../lib/outils-libelles";
import { EditeurFiche, type DescripteurChamp } from "../components/EditeurFiche";
import { OPTIONS_STATUT_DEMANDE, OPTIONS_STATUT_DECISION, OPTIONS_PRIORITE } from "../lib/statuts-libelles";
import { iconeEntite, ICONES_NAV } from "../lib/icones";
import { afficherToast } from "../lib/toast";
import { EtatVide } from "../components/EtatVide";

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

// Sous-ensemble de CHAMPS_PAR_ENTITE : uniquement ce que mettre_a_jour_* accepte
// côté serveur (jamais les champs source comme expression_brute ou symptome).
const CHAMPS_MODIFIABLES: Record<string, DescripteurChamp[]> = {
  demande: [
    { cle: "statut", label: "Statut", type: "select", options: OPTIONS_STATUT_DEMANDE },
    { cle: "reformulation", label: "Reformulation", type: "textarea" },
    { cle: "priorite", label: "Priorité", type: "select", options: [{ valeur: "", label: "—" }, ...OPTIONS_PRIORITE] },
    { cle: "priorite_arbitree_par", label: "Priorité arbitrée par", type: "texte" },
  ],
  decision: [
    { cle: "statut", label: "Statut", type: "select", options: OPTIONS_STATUT_DECISION },
    { cle: "consequences", label: "Conséquences", type: "textarea" },
    { cle: "remplacee_par", label: "Remplacée par (id)", type: "texte" },
  ],
  changement: [
    { cle: "rollback", label: "Retour arrière", type: "textarea" },
    { cle: "test_effectue", label: "Test effectué", type: "textarea" },
    { cle: "communication", label: "Communication", type: "textarea" },
  ],
  incident: [
    { cle: "cause", label: "Cause", type: "textarea" },
    { cle: "resolution", label: "Résolution", type: "textarea" },
    { cle: "resolu_le", label: "Résolu le (ISO)", type: "texte" },
    { cle: "action_preventive", label: "Action préventive", type: "textarea" },
  ],
};

function formaterValeur(cle: string, valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "";
  if (cle === "cree_le" || cle === "maj_le" || cle === "resolu_le" || cle === "annule_le") {
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
  const [edition, setEdition] = useState(false);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [enregistrement, setEnregistrement] = useState<"inactif" | "en_cours" | "erreur">("inactif");

  function charger() {
    setErreur(null);
    return recupererEntiteJournal(entite, id)
      .then((r) => setDonnees(r))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    setDonnees(null);
    setEdition(false);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entite, id]);

  const champs = CHAMPS_PAR_ENTITE[entite] ?? [];
  const champsModifiables = CHAMPS_MODIFIABLES[entite] ?? [];
  const estAnnulee = Boolean(donnees?.annule_le);

  function ouvrirEdition() {
    if (!donnees) return;
    const initial: Record<string, string> = {};
    for (const c of champsModifiables) {
      initial[c.cle] = donnees[c.cle] === null || donnees[c.cle] === undefined ? "" : String(donnees[c.cle]);
    }
    setValeurs(initial);
    setEdition(true);
    setEnregistrement("inactif");
  }

  async function enregistrer() {
    if (!donnees) return;
    const modifies: Record<string, string> = {};
    for (const c of champsModifiables) {
      const original = donnees[c.cle] === null || donnees[c.cle] === undefined ? "" : String(donnees[c.cle]);
      if (valeurs[c.cle] !== original && !(c.type === "select" && valeurs[c.cle] === "")) {
        modifies[c.cle] = valeurs[c.cle] ?? "";
      }
    }
    if (Object.keys(modifies).length === 0) {
      setEdition(false);
      return;
    }
    setEnregistrement("en_cours");
    try {
      await mettreAJourEntiteDirect(entite, id, modifies);
      await charger();
      setEdition(false);
      setEnregistrement("inactif");
      afficherToast("Fiche enregistrée.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnregistrement("erreur");
    }
  }

  async function annuler() {
    const raison = prompt(
      `Annuler cette fiche « ${TITRES_ENTITE[entite] ?? entite} » — motif (obligatoire) :`
    );
    if (raison === null) return;
    if (!raison.trim()) {
      setErreur("Un motif est requis pour annuler une entrée.");
      return;
    }
    try {
      await annulerEntiteDirect(entite, id, raison.trim());
      await charger();
      afficherToast("Entrée annulée.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

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
                {(() => {
                  const Icone = iconeEntite(entite);
                  return <Icone size={20} />;
                })()}
              </span>
              <div>
                <h1>{TITRES_ENTITE[entite] ?? entite}</h1>
              </div>
            </div>
            {!edition && !estAnnulee && (
              <div className="main__entete-actions">
                {champsModifiables.length > 0 && (
                  <button className="sidebar__nouvelle" onClick={ouvrirEdition}>
                    Modifier
                  </button>
                )}
                <button className="sidebar__nouvelle sidebar__nouvelle--danger" onClick={annuler}>
                  Annuler
                </button>
              </div>
            )}
          </div>

          {estAnnulee && (
            <div className="fiche-annulee">
              Entrée annulée le {formaterValeur("annule_le", donnees!.annule_le)} — motif :{" "}
              {String(donnees!.annulation_raison ?? "")}
            </div>
          )}

          {edition && (
            <>
              <EditeurFiche
                champs={champsModifiables}
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

          {entite === "demande" && (
            <div className="constats-groupe">
              <div className="constats-groupe__titre">Projets liés</div>
              {(() => {
                const projetsLies = (donnees.projets_lies as { id: string; nom: string }[] | undefined) ?? [];
                if (projetsLies.length === 0) {
                  return (
                    <EtatVide
                      icone={ICONES_NAV.projets}
                      phrase="Aucun projet lié à cette demande pour l'instant."
                    />
                  );
                }
                return (
                  <div className="liste">
                    {projetsLies.map((p) => (
                      <div className="ligne" key={p.id}>
                        <div className="ligne__corps">
                          <span className="ligne__resume">{p.nom}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
