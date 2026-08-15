import { useEffect, useState } from "react";
import { recupererConnaissances, creerDocumentDirect, type DocumentResume } from "../lib/api";
import { LIBELLES_TYPE_DOCUMENT } from "../lib/documents-libelles";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";
import { DocumentEditor } from "./DocumentEditor";

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function BaseConnaissances() {
  const [documents, setDocuments] = useState<DocumentResume[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [documentSelectionne, setDocumentSelectionne] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nouveauTitre, setNouveauTitre] = useState("");
  const [nouveauType, setNouveauType] = useState("architecture_existante");
  const [creationEnCours, setCreationEnCours] = useState(false);

  function charger() {
    setErreur(null);
    recupererConnaissances()
      .then((r) => setDocuments(r.documents))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    charger();
  }, []);

  async function creerPage() {
    if (!nouveauTitre.trim()) return;
    setCreationEnCours(true);
    try {
      const r = await creerDocumentDirect({ type: nouveauType, titre: nouveauTitre.trim() });
      setFormulaireOuvert(false);
      setNouveauTitre("");
      setDocumentSelectionne(r.id);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setCreationEnCours(false);
    }
  }

  if (documentSelectionne) {
    return (
      <DocumentEditor
        id={documentSelectionne}
        retourLabel="Base de connaissances"
        onRetour={() => {
          setDocumentSelectionne(null);
          charger();
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader vue="connaissances" groupe="Projets" titre="Base de connaissances">
        <button className="btn" onClick={() => setFormulaireOuvert((v) => !v)}>
          + Nouvelle page
        </button>
        <ActionsGlobales />
      </PageHeader>

      {formulaireOuvert && (
        <div className="editeur__formulaire">
          <select value={nouveauType} onChange={(e) => setNouveauType(e.target.value)} aria-label="Type de page">
            {Object.entries(LIBELLES_TYPE_DOCUMENT).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Titre de la page"
            value={nouveauTitre}
            onChange={(e) => setNouveauTitre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && creerPage()}
          />
          <button className="btn btn--primaire" onClick={creerPage} disabled={!nouveauTitre.trim() || creationEnCours}>
            Créer
          </button>
        </div>
      )}

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && documents === null && <div className="chargement">Chargement…</div>}
      {!erreur && documents !== null && documents.length === 0 && !formulaireOuvert && (
        <div className="etat-vide">Aucune page pour l'instant.</div>
      )}
      {!erreur && documents !== null && documents.length > 0 && (
        <div className="liste">
          {documents.map((doc) => (
            <button className="ligne ligne--cliquable" key={doc.id} onClick={() => setDocumentSelectionne(doc.id)}>
              <div className="ligne__corps">
                <span className="badge badge--neutre">{LIBELLES_TYPE_DOCUMENT[doc.type] ?? doc.type}</span>
                <span className="ligne__resume">{doc.titre}</span>
                <span className="main__soustitre" style={{ marginLeft: "auto" }}>
                  {formaterDate(doc.maj_le)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
