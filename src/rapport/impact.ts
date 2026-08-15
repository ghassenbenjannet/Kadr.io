// Rendu markdown de la sortie de l'outil impact(), pour joindre à une demande
// de validation avant changement (§6 spec technique Jalon 2).

interface AutomatisationImpact {
  nom: string;
  type: string;
  sens: "lit" | "ecrit";
}

interface IntegrationImpact {
  nom: string;
  sens: "lit" | "ecrit";
}

interface HabilitationImpact {
  profil: string;
  droits: string;
}

interface ChampImpact {
  nom: string;
  module: string;
}

interface HistoriqueLigne {
  changement_id: string;
  date: string;
  description: string;
}

export interface SortieImpact {
  cible: { type: string; nom: string; id: string };
  impacts: {
    automatisations: AutomatisationImpact[];
    integrations: IntegrationImpact[];
    habilitations: HabilitationImpact[];
    champs?: ChampImpact[];
  };
  historique: HistoriqueLigne[];
  resume: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateComplete(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function rendreImpactMarkdown(sortie: SortieImpact): string {
  const lignes: string[] = [];

  lignes.push(`# Impact — ${sortie.cible.type} « ${sortie.cible.nom} »`);
  lignes.push("");
  lignes.push(sortie.resume);
  lignes.push("");

  lignes.push("## Automatisations concernées");
  if (sortie.impacts.automatisations.length === 0) {
    lignes.push("Aucune.");
  } else {
    for (const a of sortie.impacts.automatisations) {
      lignes.push(`— ${a.nom} (${a.type}) — ${a.sens === "lit" ? "lecture" : "écriture"}`);
    }
  }
  lignes.push("");

  lignes.push("## Intégrations concernées");
  if (sortie.impacts.integrations.length === 0) {
    lignes.push("Aucune.");
  } else {
    for (const i of sortie.impacts.integrations) {
      lignes.push(`— ${i.nom} — ${i.sens === "lit" ? "lecture" : "écriture"}`);
    }
  }
  lignes.push("");

  lignes.push("## Habilitations concernées");
  if (sortie.impacts.habilitations.length === 0) {
    lignes.push("Aucune.");
  } else {
    for (const h of sortie.impacts.habilitations) {
      lignes.push(`— ${h.profil} : ${h.droits}`);
    }
  }

  if (sortie.impacts.champs) {
    lignes.push("");
    lignes.push("## Champs concernés");
    if (sortie.impacts.champs.length === 0) {
      lignes.push("Aucun.");
    } else {
      for (const c of sortie.impacts.champs) {
        lignes.push(`— ${c.nom} (${c.module})`);
      }
    }
  }

  lignes.push("");
  lignes.push("## Historique");
  if (sortie.historique.length === 0) {
    lignes.push("Aucun changement enregistré.");
  } else {
    for (const h of sortie.historique) {
      lignes.push(`— ${formatDateComplete(h.date)} : ${h.description}`);
    }
  }

  return lignes.join("\n") + "\n";
}
