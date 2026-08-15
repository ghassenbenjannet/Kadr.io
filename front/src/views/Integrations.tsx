import { useEffect, useState } from "react";
import { recupererIntegrations, type IntegrationAvecConstats } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";

export function Integrations() {
  const [integrations, setIntegrations] = useState<IntegrationAvecConstats[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    recupererIntegrations()
      .then((r) => setIntegrations(r.integrations))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <PageHeader groupe="Cartographie" titre="Carte des intégrations">
        <ActionsGlobales />
      </PageHeader>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && integrations === null && <div className="chargement">Chargement…</div>}
      {!erreur && integrations !== null && integrations.length === 0 && (
        <div className="etat-vide">Aucune intégration décrite pour l'instant.</div>
      )}
      {!erreur && integrations !== null && integrations.length > 0 && (
        <div className="tableau-scroll">
          <table>
            <thead>
              <tr>
                <th>Intégration</th>
                <th>Source → Cible</th>
                <th>Constats ouverts</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr key={i.id}>
                  <td>{i.nom}</td>
                  <td>
                    {i.source} → {i.cible}
                  </td>
                  <td>
                    {i.constatsOuverts === 0 ? (
                      <span className="main__soustitre">aucun point de vigilance</span>
                    ) : (
                      <span className="badge badge--attention">{i.constatsOuverts} point(s)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
