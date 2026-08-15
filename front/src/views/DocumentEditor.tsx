import { useEffect, useState } from "react";
import { recupererDocument, mettreAJourDocumentDirect, supprimerDocumentDirect, type DocumentComplet } from "../lib/api";
import { rendreMarkdownLeger } from "../lib/markdown-lite";
import { LIBELLES_TYPE_DOCUMENT } from "../lib/documents-libelles";

export function DocumentEditor({
  id,
  retourLabel,
  onRetour,
}: {
  id: string;
  retourLabel?: string;
  onRetour: () => void;
}) {
  const [document, setDocument] = useState<DocumentComplet | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [mode, setMode] = useState<"edition" | "apercu">("edition");
  const [statutEnregistrement, setStatutEnregistrement] = useState<"inactif" | "en_cours" | "enregistre" | "erreur">(
    "inactif"
  );

  useEffect(() => {
    let annule = false;
    recupererDocument(id)
      .then((r) => {
        if (annule) return;
        setDocument(r);
        setTitre(r.titre);
        setContenu(r.contenu);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      });
    return () => {
      annule = true;
    };
  }, [id]);

  const modifie = document !== null && (titre !== document.titre || contenu !== document.contenu);

  async function enregistrer() {
    setStatutEnregistrement("en_cours");
    try {
      await mettreAJourDocumentDirect(id, { titre, contenu });
      setDocument((d) => (d ? { ...d, titre, contenu } : d));
      setStatutEnregistrement("enregistre");
      setTimeout(() => setStatutEnregistrement("inactif"), 1600);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setStatutEnregistrement("erreur");
    }
  }

  async function supprimer() {
    if (!document) return;
    if (!confirm(`Supprimer la page « ${document.titre} » ?`)) return;
    try {
      await supprimerDocumentDirect(id);
      onRetour();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <button className="lien-retour" onClick={onRetour}>
        ← {retourLabel ?? document?.projet?.nom ?? "Retour"}
      </button>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && document === null && <div className="chargement">Chargement…</div>}

      {!erreur && document !== null && (
        <>
          <div className="editeur__entete">
            <input
              className="editeur__titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              aria-label="Titre de la page"
            />
            <span className="badge badge--neutre">{LIBELLES_TYPE_DOCUMENT[document.type] ?? document.type}</span>
            <button className="sidebar__nouvelle sidebar__nouvelle--danger" onClick={supprimer}>
              Supprimer
            </button>
          </div>

          <div className="editeur__barre">
            <div className="editeur__onglets">
              <button
                className={`editeur__onglet${mode === "edition" ? " editeur__onglet--actif" : ""}`}
                onClick={() => setMode("edition")}
              >
                Édition
              </button>
              <button
                className={`editeur__onglet${mode === "apercu" ? " editeur__onglet--actif" : ""}`}
                onClick={() => setMode("apercu")}
              >
                Aperçu
              </button>
            </div>
            <div className="editeur__actions">
              <span className="editeur__statut">
                {statutEnregistrement === "enregistre" && "Enregistré"}
                {statutEnregistrement === "erreur" && "Échec de l'enregistrement"}
                {statutEnregistrement === "inactif" && modifie && "Modifications non enregistrées"}
              </span>
              <button className="btn btn--primaire" onClick={enregistrer} disabled={!modifie || statutEnregistrement === "en_cours"}>
                Enregistrer
              </button>
            </div>
          </div>

          {mode === "edition" ? (
            <textarea
              className="editeur__zone"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <div className="rapport editeur__apercu">{rendreMarkdownLeger(contenu)}</div>
          )}
        </>
      )}
    </div>
  );
}
