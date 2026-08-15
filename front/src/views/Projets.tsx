import { useEffect, useState } from "react";
import { recupererProjets, creerProjetDirect, type ProjetResume } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";
import { ProjetDetail } from "./ProjetDetail";
import { EditeurFiche, type DescripteurChamp } from "../components/EditeurFiche";

const CHAMPS_CREATION: DescripteurChamp[] = [
  { cle: "nom", label: "Nom du projet", type: "texte", requis: true },
  { cle: "description", label: "Description", type: "textarea" },
];

export function Projets() {
  const [projets, setProjets] = useState<ProjetResume[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [idSelectionne, setIdSelectionne] = useState<string | undefined>(undefined);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [valeurs, setValeurs] = useState<Record<string, string>>({ nom: "", description: "" });
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);

  function charger() {
    setErreur(null);
    return recupererProjets()
      .then((r) => setProjets(r.projets))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function creer() {
    if (!valeurs.nom?.trim()) {
      setErreurCreation("« Nom du projet » est requis.");
      return;
    }
    setCreationEnCours(true);
    setErreurCreation(null);
    try {
      const r = await creerProjetDirect({
        nom: valeurs.nom.trim(),
        description: valeurs.description || undefined,
      });
      setCreationOuverte(false);
      setValeurs({ nom: "", description: "" });
      setIdSelectionne(r.id);
    } catch (e) {
      setErreurCreation(e instanceof Error ? e.message : String(e));
    } finally {
      setCreationEnCours(false);
    }
  }

  if (idSelectionne) {
    return (
      <ProjetDetail
        id={idSelectionne}
        onRetour={() => {
          setIdSelectionne(undefined);
          charger();
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader vue="projets" groupe="Projets" titre="Projets">
        <button className="btn" onClick={() => setCreationOuverte((v) => !v)}>
          {creationOuverte ? "Fermer" : "+ Nouveau projet"}
        </button>
        <ActionsGlobales />
      </PageHeader>

      {creationOuverte && (
        <div className="editeur-fiche">
          <EditeurFiche
            champs={CHAMPS_CREATION}
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

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && projets === null && <div className="chargement">Chargement…</div>}
      {!erreur && projets !== null && projets.length === 0 && (
        <div className="etat-vide">Aucun projet pour l'instant.</div>
      )}
      {!erreur && projets !== null && projets.length > 0 && (
        <div className="liste">
          {projets.map((p) => (
            <button className="ligne ligne--cliquable" key={p.id} onClick={() => setIdSelectionne(p.id)}>
              <div className="ligne__corps">
                <span className="badge badge--neutre">{p.statut}</span>
                <span className="ligne__resume">{p.nom}</span>
                <span className="main__soustitre" style={{ marginLeft: "auto" }}>
                  {p.epics} epic{p.epics === 1 ? "" : "s"} · {p.tickets_ouverts}/{p.tickets_total} ticket
                  {p.tickets_total === 1 ? "" : "s"} ouvert{p.tickets_ouverts === 1 ? "" : "s"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
