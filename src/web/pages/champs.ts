import type Database from "better-sqlite3";
import { page, echapper, type OptionsPage } from "../layout.js";
import { champsParSourceDeVerite } from "../donnees.js";

export function rendrePageChamps(db: Database.Database, options: OptionsPage = {}): string {
  const groupes = champsParSourceDeVerite(db);

  let corps: string;
  if (groupes.length === 0) {
    corps = `<p class="muted">Aucun champ décrit pour l'instant.</p>`;
  } else {
    corps = groupes
      .map((g) => {
        const lignes = g.champs
          .map((c) => {
            const editabilite = c.editable === null ? "non déclarée" : c.editable === 1 ? "éditable" : "lecture seule";
            const alerte = c.contredit
              ? ` <span class="alerte" style="display:inline-block;padding:0.1rem 0.5rem;margin:0">⚠ contredit sa source</span>`
              : "";
            return `<tr><td>${echapper(c.systeme)}</td><td>${echapper(c.module)}</td><td>${echapper(c.nom)}${alerte}</td><td>${editabilite}</td></tr>`;
          })
          .join("");
        return `<h2>${echapper(g.source)}</h2><table><thead><tr><th>Système</th><th>Module</th><th>Champ</th><th>Éditabilité</th></tr></thead><tbody>${lignes}</tbody></table>`;
      })
      .join("");
  }

  return page("Champs par source de vérité", corps, { cheminActif: "/champs", ...options });
}
