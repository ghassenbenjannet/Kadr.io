import type Database from "better-sqlite3";
import { page, echapper, type OptionsPage } from "../layout.js";
import { matriceHabilitations, modulesDistincts, type DroitCellule } from "../donnees.js";

function libelleCellule(droit: DroitCellule | undefined): { texte: string; classe: string } {
  switch (droit) {
    case "editable":
      return { texte: "Édite", classe: "editable" };
    case "visible":
      return { texte: "Visible", classe: "" };
    case "masque":
      return { texte: "Masqué", classe: "masque" };
    default:
      return { texte: "non déclaré", classe: "non-declare" };
  }
}

export function rendrePageHabilitations(
  db: Database.Database,
  moduleFiltre: string | undefined,
  options: OptionsPage = {}
): string {
  const { champs, profils, cellules } = matriceHabilitations(db, moduleFiltre);
  const modules = modulesDistincts(db);

  const selecteur = `
    <form method="get" style="margin-bottom:1rem">
      <label for="module">Filtrer par module : </label>
      <select id="module" name="module" onchange="location.href = this.value ? ('?module=' + encodeURIComponent(this.value)) : location.pathname">
        <option value="">— tous les modules —</option>
        ${modules
          .map(
            (m) =>
              `<option value="${echapper(m)}"${m === moduleFiltre ? " selected" : ""}>${echapper(m)}</option>`
          )
          .join("")}
      </select>
    </form>`;

  let corps: string;
  if (champs.length === 0) {
    corps = `${selecteur}<p class="muted">Aucun champ décrit${moduleFiltre ? ` pour le module « ${echapper(moduleFiltre)} »` : ""}.</p>`;
  } else if (profils.length === 0) {
    corps = `${selecteur}<p class="muted">Aucune habilitation décrite pour l'instant.</p>`;
  } else {
    const entetes = profils.map((p) => `<th class="centre">${echapper(p)}</th>`).join("");
    const lignes = champs
      .map((c) => {
        const cellulesHtml = profils
          .map((p) => {
            const { texte, classe } = libelleCellule(cellules.get(`${c.id}|${p}`));
            return `<td class="centre ${classe}">${texte}</td>`;
          })
          .join("");
        return `<tr><td>${echapper(c.module)}</td><td>${echapper(c.nom)}</td>${cellulesHtml}</tr>`;
      })
      .join("");
    corps = `${selecteur}<table><thead><tr><th>Module</th><th>Champ</th>${entetes}</tr></thead><tbody>${lignes}</tbody></table>
    <p class="muted">« non déclaré » signifie qu'aucune habilitation n'a été décrite pour ce profil sur ce champ — ce n'est pas équivalent à « masqué ».</p>`;
  }

  return page("Matrice d'habilitations", corps, { cheminActif: "/", ...options });
}
