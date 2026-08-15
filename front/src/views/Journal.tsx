import { useEffect, useState } from "react";
import { recupererJournal, creerEntiteDirect, type LigneJournal } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { EntiteDetail } from "./EntiteDetail";
import { EditeurFiche, type DescripteurChamp } from "../components/EditeurFiche";
import { OPTIONS_EQUIPE, OPTIONS_TYPE_DEMANDE, OPTIONS_TYPE_CHANGEMENT, OPTIONS_PRIORITE } from "../lib/statuts-libelles";

const LIBELLES_ENTITE: Record<string, string> = {
  demande: "Demande",
  decision: "Décision",
  changement: "Changement",
  incident: "Incident",
};

type TypeCreation = "demande" | "decision" | "changement" | "incident";

const CHAMPS_CREATION: Record<TypeCreation, DescripteurChamp[]> = {
  demande: [
    { cle: "demandeur", label: "Demandeur", type: "texte", requis: true },
    { cle: "equipe", label: "Équipe", type: "select", options: OPTIONS_EQUIPE, requis: true },
    { cle: "expression_brute", label: "Expression brute", type: "textarea", requis: true },
    { cle: "type", label: "Type", type: "select", options: OPTIONS_TYPE_DEMANDE, requis: true },
    { cle: "reformulation", label: "Reformulation", type: "textarea" },
    { cle: "priorite", label: "Priorité", type: "select", options: [{ valeur: "", label: "—" }, ...OPTIONS_PRIORITE] },
    { cle: "priorite_arbitree_par", label: "Priorité arbitrée par", type: "texte" },
  ],
  decision: [
    { cle: "contexte", label: "Contexte", type: "textarea", requis: true },
    { cle: "decision", label: "Décision retenue", type: "textarea", requis: true },
    { cle: "decideur", label: "Décideur", type: "texte", requis: true },
    { cle: "option_retenue", label: "Option retenue", type: "texte", requis: true },
    { cle: "consequences", label: "Conséquences", type: "textarea" },
  ],
  changement: [
    { cle: "description", label: "Description", type: "textarea", requis: true },
    { cle: "perimetre", label: "Périmètre", type: "texte", requis: true },
    { cle: "type", label: "Type", type: "select", options: OPTIONS_TYPE_CHANGEMENT, requis: true },
    { cle: "rollback", label: "Retour arrière", type: "textarea" },
    { cle: "test_effectue", label: "Test effectué", type: "textarea" },
    { cle: "communication", label: "Communication", type: "textarea" },
  ],
  incident: [
    { cle: "symptome", label: "Symptôme", type: "textarea", requis: true },
    { cle: "impact", label: "Impact", type: "textarea", requis: true },
    { cle: "cause", label: "Cause", type: "textarea" },
    { cle: "resolution", label: "Résolution", type: "textarea" },
    { cle: "action_preventive", label: "Action préventive", type: "textarea" },
  ],
};

function valeursInitiales(type: TypeCreation): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const c of CHAMPS_CREATION[type]) {
    initial[c.cle] = c.type === "select" ? (c.options?.[0]?.valeur ?? "") : "";
  }
  return initial;
}

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function Journal() {
  const [entite, setEntite] = useState("");
  const [lignes, setLignes] = useState<LigneJournal[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ entite: string; id: string } | null>(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [typeCreation, setTypeCreation] = useState<TypeCreation>("demande");
  const [valeurs, setValeurs] = useState<Record<string, string>>(() => valeursInitiales("demande"));
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);

  function charger() {
    setErreur(null);
    return recupererJournal({ entite: entite || undefined })
      .then((r) => setLignes(r.journal))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    setLignes(null);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entite]);

  function changerTypeCreation(type: TypeCreation) {
    setTypeCreation(type);
    setValeurs(valeursInitiales(type));
    setErreurCreation(null);
  }

  async function creer() {
    const champs = CHAMPS_CREATION[typeCreation];
    for (const c of champs) {
      if (c.requis && !valeurs[c.cle]?.trim()) {
        setErreurCreation(`« ${c.label} » est requis.`);
        return;
      }
    }
    const payload: Record<string, unknown> = {};
    for (const c of champs) {
      if (c.cle === "option_retenue") continue;
      if (valeurs[c.cle]) payload[c.cle] = valeurs[c.cle];
    }
    if (typeCreation === "decision") {
      payload.options = [{ option: valeurs.option_retenue }];
    }

    setCreationEnCours(true);
    setErreurCreation(null);
    try {
      await creerEntiteDirect(typeCreation, payload);
      setCreationOuverte(false);
      charger();
    } catch (e) {
      setErreurCreation(e instanceof Error ? e.message : String(e));
    } finally {
      setCreationEnCours(false);
    }
  }

  if (selection) {
    return (
      <EntiteDetail entite={selection.entite} id={selection.id} onRetour={() => setSelection(null)} />
    );
  }

  return (
    <div>
      <PageHeader icone="☰" titre="Journal" sousTitre="Demandes, décisions, changements, incidents.">
        <button
          className="sidebar__nouvelle"
          onClick={() => {
            changerTypeCreation(typeCreation);
            setCreationOuverte((v) => !v);
          }}
        >
          {creationOuverte ? "Fermer" : "+ Nouvelle entrée"}
        </button>
      </PageHeader>

      {creationOuverte && (
        <div className="editeur-fiche">
          <div className="champ">
            <label className="champ__label" htmlFor="type-creation">
              Type
            </label>
            <select
              id="type-creation"
              value={typeCreation}
              onChange={(e) => changerTypeCreation(e.target.value as TypeCreation)}
            >
              <option value="demande">Demande</option>
              <option value="decision">Décision</option>
              <option value="changement">Changement</option>
              <option value="incident">Incident</option>
            </select>
          </div>

          <EditeurFiche
            champs={CHAMPS_CREATION[typeCreation]}
            valeurs={valeurs}
            onChange={(cle, valeur) => setValeurs((v) => ({ ...v, [cle]: valeur }))}
          />

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

      <div className="filtre">
        <select value={entite} onChange={(e) => setEntite(e.target.value)} aria-label="Filtrer par type">
          <option value="">Toutes les entités</option>
          <option value="demande">Demandes</option>
          <option value="decision">Décisions</option>
          <option value="changement">Changements</option>
          <option value="incident">Incidents</option>
        </select>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && lignes === null && <div className="chargement">Chargement…</div>}
      {!erreur && lignes !== null && lignes.length === 0 && (
        <div className="etat-vide">Rien à afficher pour l'instant.</div>
      )}
      {!erreur && lignes !== null && lignes.length > 0 && (
        <div className="liste">
          {lignes.map((l) => (
            <button
              className="ligne ligne--cliquable"
              key={`${l.entite}-${l.id}`}
              onClick={() => setSelection({ entite: l.entite, id: l.id })}
            >
              <div className="ligne__date mono">{formaterDate(l.date)}</div>
              <div className="ligne__corps">
                <span className="badge badge--neutre">{LIBELLES_ENTITE[l.entite] ?? l.entite}</span>
                <span className="ligne__resume">{l.resume}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
