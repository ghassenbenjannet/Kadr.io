import { useEffect, useState } from "react";
import { recupererJournal, type LigneJournal } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { EntiteDetail } from "./EntiteDetail";

const LIBELLES_ENTITE: Record<string, string> = {
  demande: "Demande",
  decision: "Décision",
  changement: "Changement",
  incident: "Incident",
};

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function Journal() {
  const [entite, setEntite] = useState("");
  const [lignes, setLignes] = useState<LigneJournal[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ entite: string; id: string } | null>(null);

  useEffect(() => {
    let annule = false;
    setLignes(null);
    setErreur(null);
    recupererJournal({ entite: entite || undefined })
      .then((r) => {
        if (!annule) setLignes(r.journal);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      });
    return () => {
      annule = true;
    };
  }, [entite]);

  if (selection) {
    return (
      <EntiteDetail entite={selection.entite} id={selection.id} onRetour={() => setSelection(null)} />
    );
  }

  return (
    <div>
      <PageHeader icone="☰" titre="Journal" sousTitre="Demandes, décisions, changements, incidents — lecture seule." />

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
