import type Database from "better-sqlite3";
import { page, echapper, type OptionsPage } from "../layout.js";
import { integrationsAvecConstats } from "../donnees.js";

export function rendrePageIntegrations(db: Database.Database, options: OptionsPage = {}): string {
  const integrations = integrationsAvecConstats(db);

  let corps: string;
  if (integrations.length === 0) {
    corps = `<p class="muted">Aucune intégration décrite pour l'instant.</p>`;
  } else {
    const lignes = integrations
      .map((i) => {
        const etat =
          i.constatsOuverts === 0
            ? '<span class="muted">aucun point de vigilance</span>'
            : `<strong>${i.constatsOuverts}</strong> point(s) de vigilance`;
        return `<tr><td>${echapper(i.nom)}</td><td>${echapper(i.source)} → ${echapper(i.cible)}</td><td>${etat}</td></tr>`;
      })
      .join("");
    corps = `<table><thead><tr><th>Intégration</th><th>Source → Cible</th><th>Constats ouverts</th></tr></thead><tbody>${lignes}</tbody></table>`;
  }

  return page("Carte des intégrations", corps, { cheminActif: "/integrations", ...options });
}
