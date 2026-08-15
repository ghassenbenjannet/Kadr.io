import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { recupererJournal, creerEntiteDirect, type LigneJournal } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";
import { EntiteDetail } from "./EntiteDetail";
import { EditeurFiche, type DescripteurChamp } from "../components/EditeurFiche";
import { OPTIONS_EQUIPE, OPTIONS_TYPE_DEMANDE, OPTIONS_TYPE_CHANGEMENT, OPTIONS_PRIORITE } from "../lib/statuts-libelles";
import { definirOuvertureCreationJournal } from "../lib/navigation";
import { BadgeEntite } from "../components/BadgeEntite";
import { EtatVide } from "../components/EtatVide";
import { SqueletteListe } from "../components/Squelette";
import { ICONES_NAV } from "../lib/icones";
import { afficherToast } from "../lib/toast";

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

const FILTRES_ENTITE: { valeur: string; label: string }[] = [
  { valeur: "", label: "Tout" },
  { valeur: "demande", label: "Demandes" },
  { valeur: "decision", label: "Décisions" },
  { valeur: "changement", label: "Changements" },
  { valeur: "incident", label: "Incidents" },
];

export function Journal() {
  const [entite, setEntite] = useState("");
  const [recherche, setRecherche] = useState("");
  const [afficherAnnulees, setAfficherAnnulees] = useState(false);
  const [lignes, setLignes] = useState<LigneJournal[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ entite: string; id: string } | null>(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [typeCreation, setTypeCreation] = useState<TypeCreation>("demande");
  const [valeurs, setValeurs] = useState<Record<string, string>>(() => valeursInitiales("demande"));
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [erreursCreation, setErreursCreation] = useState<Record<string, string>>({});
  const [triAscendant, setTriAscendant] = useState(false);

  useEffect(() => {
    definirOuvertureCreationJournal(() => {
      changerTypeCreation(typeCreation);
      setCreationOuverte(true);
    });
    return () => definirOuvertureCreationJournal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCreation]);

  function charger() {
    setErreur(null);
    return recupererJournal({ entite: entite || undefined, inclureAnnulees: afficherAnnulees })
      .then((r) => setLignes(r.journal))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    setLignes(null);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entite, afficherAnnulees]);

  function changerTypeCreation(type: TypeCreation) {
    setTypeCreation(type);
    setValeurs(valeursInitiales(type));
    setErreursCreation({});
  }

  async function creer() {
    const champs = CHAMPS_CREATION[typeCreation];
    const erreursChamps: Record<string, string> = {};
    for (const c of champs) {
      if (c.requis && !valeurs[c.cle]?.trim()) {
        erreursChamps[c.cle] = "Ce champ est requis.";
      }
    }
    if (Object.keys(erreursChamps).length > 0) {
      setErreursCreation(erreursChamps);
      return;
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
    setErreursCreation({});
    try {
      await creerEntiteDirect(typeCreation, payload);
      setCreationOuverte(false);
      charger();
      afficherToast("Entrée créée dans le journal.");
    } catch (e) {
      setErreursCreation({ _global: e instanceof Error ? e.message : String(e) });
    } finally {
      setCreationEnCours(false);
    }
  }

  if (selection) {
    return (
      <EntiteDetail
        entite={selection.entite}
        id={selection.id}
        onRetour={() => {
          setSelection(null);
          charger();
        }}
      />
    );
  }

  const lignesFiltrees = (lignes ?? []).filter(
    (l) => !recherche.trim() || l.resume.toLowerCase().includes(recherche.trim().toLowerCase())
  );

  return (
    <div>
      <PageHeader vue="journal" groupe="Mémoire" titre="Journal">
        <ActionsGlobales />
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
            erreurs={erreursCreation}
          />

          {erreursCreation._global && <div className="erreur">{erreursCreation._global}</div>}
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

      <div className="pilules">
        {FILTRES_ENTITE.map((f) => (
          <button
            key={f.valeur}
            className={`pilule${entite === f.valeur ? " pilule--actif" : ""}`}
            onClick={() => setEntite(f.valeur)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="journal-barre">
        <input
          className="recherche"
          type="search"
          placeholder="Rechercher dans le journal…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          aria-label="Rechercher dans le journal"
        />
        <label className="journal-filtre-annulees">
          <input
            type="checkbox"
            checked={afficherAnnulees}
            onChange={(e) => setAfficherAnnulees(e.target.checked)}
          />
          Afficher les annulées
        </label>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && lignes === null && <SqueletteListe />}
      {!erreur && lignes !== null && lignesFiltrees.length === 0 && (
        <EtatVide
          icone={ICONES_NAV.journal}
          phrase={
            recherche.trim() || entite
              ? "Aucune entrée ne correspond à ce filtre."
              : "Le journal est vide pour l'instant."
          }
          action={{
            label: "Nouvelle entrée",
            onClick: () => {
              changerTypeCreation(typeCreation);
              setCreationOuverte(true);
            },
          }}
        />
      )}
      {!erreur && lignes !== null && lignesFiltrees.length > 0 && (
        <>
          <div className="table-entete">
            <button
              className="table-entete__col table-entete__col--date"
              onClick={() => setTriAscendant((v) => !v)}
              title={triAscendant ? "Trier du plus récent au plus ancien" : "Trier du plus ancien au plus récent"}
            >
              Date
              {triAscendant ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
            </button>
            <div className="table-entete__col">Type / résumé</div>
          </div>
          <div className="liste">
            {[...lignesFiltrees]
              .sort((a, b) => (triAscendant ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))
              .map((l) => (
                <button
                  className={`ligne ligne--cliquable${l.annule ? " ligne--annulee" : ""}`}
                  key={`${l.entite}-${l.id}`}
                  onClick={() => setSelection({ entite: l.entite, id: l.id })}
                >
                  <div className="ligne__date mono">{formaterDate(l.date)}</div>
                  <div className="ligne__corps">
                    <BadgeEntite entite={l.entite} />
                    <span className="ligne__resume">{l.resume}</span>
                    {l.annule && <span className="ligne__annulation">annulée — {l.annulationRaison}</span>}
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
