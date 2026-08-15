import { useEffect, useState } from "react";
import { recupererTableauDeBord, type TableauDeBord } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";
import { LIBELLES_ENTITE, badgeEntite } from "../lib/entite-libelles";
import { naviguerVers } from "../lib/navigation";

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function Aujourdhui() {
  const [donnees, setDonnees] = useState<TableauDeBord | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    recupererTableauDeBord()
      .then((r) => setDonnees(r))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  const resume = donnees?.resumeSemaine;
  const phraseRapport = resume
    ? `Le rendu de la semaine est prêt : ${resume.demandes} demande${resume.demandes === 1 ? "" : "s"}, ` +
      `${resume.decisions} décision${resume.decisions === 1 ? "" : "s"}, ${resume.changements} changement` +
      `${resume.changements === 1 ? "" : "s"}, ${resume.incidentsClos} incident${resume.incidentsClos === 1 ? "" : "s"} clos.`
    : "";

  return (
    <div>
      <PageHeader groupe="Pilotage" titre="Aujourd'hui">
        <ActionsGlobales />
      </PageHeader>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && donnees === null && <div className="chargement">Chargement…</div>}

      {!erreur && donnees !== null && (
        <>
          <div className="tableau-bord__stats">
            <div className="stat-carte">
              <div className="stat-carte__label">Demandes en attente</div>
              <div className="stat-carte__valeur">{donnees.demandesEnAttente}</div>
            </div>
            <div className="stat-carte">
              <div className="stat-carte__label">Constats ouverts</div>
              <div className="stat-carte__valeur">{donnees.constatsOuverts}</div>
            </div>
            <div className="stat-carte">
              <div className="stat-carte__label">Changements 7 j</div>
              <div className="stat-carte__valeur">{donnees.changements7j}</div>
            </div>
            <div className="stat-carte">
              <div className="stat-carte__label">Incidents ouverts</div>
              <div className="stat-carte__valeur">{donnees.incidentsOuverts}</div>
            </div>
          </div>

          <div className="tableau-bord__corps">
            <div className="carte">
              <div className="carte__entete">
                <span className="carte__titre">Cette semaine dans le journal</span>
                <button className="carte__lien" onClick={() => naviguerVers("journal")}>
                  Tout voir
                </button>
              </div>
              {donnees.journalSemaine.length === 0 && (
                <div className="etat-vide">Rien de nouveau cette semaine.</div>
              )}
              {donnees.journalSemaine.length > 0 && (
                <div className="liste" style={{ boxShadow: "none", border: "none" }}>
                  {donnees.journalSemaine.map((l) => (
                    <div className="ligne" key={`${l.entite}-${l.id}`}>
                      <span className="ligne__date mono">{formaterDate(l.date)}</span>
                      <div className="ligne__corps">
                        <span className={badgeEntite(l.entite)}>{LIBELLES_ENTITE[l.entite] ?? l.entite}</span>
                        <span className="ligne__resume">{l.resume}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="carte">
                <div className="carte__entete">
                  <span className="carte__titre">Vigie</span>
                  {donnees.constatsOuverts > 0 && (
                    <span className="badge-compte">{donnees.constatsOuverts} ouverts</span>
                  )}
                </div>
                {donnees.vigie.length === 0 && <div className="etat-vide">Aucun constat ouvert.</div>}
                {donnees.vigie.length > 0 && (
                  <div className="vigie-liste">
                    {donnees.vigie.map((v, i) => (
                      <div className="vigie-item" key={i}>
                        <div className="vigie-item__point" />
                        <div>
                          <div className="vigie-item__titre">{v.resume}</div>
                          <div className="vigie-item__texte">{v.consequence}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rapport-carte">
                <div className="rapport-carte__titre">Rapport du vendredi</div>
                <div className="rapport-carte__texte">{phraseRapport}</div>
                <button className="btn" onClick={() => naviguerVers("rapport")}>
                  Ouvrir le rapport
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
