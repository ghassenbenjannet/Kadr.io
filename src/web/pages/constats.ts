import type Database from "better-sqlite3";
import { page, echapper, type OptionsPage } from "../layout.js";
import { collecterDonneesEtatSi } from "../../rapport/etat-si.js";

const FAMILLES: Array<{ cle: "pratique" | "modele" | "integration"; titre: string }> = [
  { cle: "pratique", titre: "Journal (pratique)" },
  { cle: "modele", titre: "Modèle" },
  { cle: "integration", titre: "Intégration" },
];

export function rendrePageConstats(db: Database.Database, options: OptionsPage = {}): string {
  const { constats } = collecterDonneesEtatSi(db);

  let corps: string;
  if (constats.length === 0) {
    corps = `<p class="muted">Aucun constat ouvert.</p>`;
  } else {
    corps = FAMILLES.map((f) => {
      const items = constats.filter((c) => c.famille === f.cle);
      if (items.length === 0) return "";
      const liste = items
        .map((c) => `<li><strong>${echapper(c.resume)}</strong> — ${echapper(c.consequence)}</li>`)
        .join("");
      return `<h2>${f.titre}</h2><ul class="constats">${liste}</ul>`;
    }).join("");
  }

  return page("Constats ouverts", corps, { cheminActif: "/constats", ...options });
}
