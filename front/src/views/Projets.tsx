import { useEffect, useState } from "react";
import { recupererProjets, type ProjetResume } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ProjetDetail } from "./ProjetDetail";

export function Projets() {
  const [projets, setProjets] = useState<ProjetResume[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [idSelectionne, setIdSelectionne] = useState<string | undefined>(undefined);

  useEffect(() => {
    recupererProjets()
      .then((r) => setProjets(r.projets))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  if (idSelectionne) {
    return <ProjetDetail id={idSelectionne} onRetour={() => setIdSelectionne(undefined)} />;
  }

  return (
    <div>
      <PageHeader
        icone="▣"
        titre="Projets"
        sousTitre="Demande → projet → epic → ticket, avec sa suite de recette."
      />

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
