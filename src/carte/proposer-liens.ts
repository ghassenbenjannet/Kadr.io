import type Database from "better-sqlite3";

export interface PropositionLien {
  entite_carte: "champ" | "module" | "integration" | "automatisation";
  systeme?: string;
  module?: string;
  nom: string;
}

/**
 * Cherche, dans un texte libre de périmètre, des noms qui correspondent à des
 * éléments déjà décrits dans la carte (champs, modules, intégrations,
 * automatisations). Ne modifie rien : les résultats sont des PROPOSITIONS,
 * validées par un appel explicite à lier_changement (principe du CDC §3.5).
 */
export function proposerLiensPourPerimetre(db: Database.Database, perimetre: string): PropositionLien[] {
  const texte = perimetre.toLowerCase();
  const propositions: PropositionLien[] = [];

  const champs = db
    .prepare(
      `SELECT c.nom, m.nom AS module_nom, s.nom AS systeme_nom FROM champs c
       JOIN modules m ON m.id = c.module_id JOIN systemes s ON s.id = m.systeme_id`
    )
    .all() as { nom: string; module_nom: string; systeme_nom: string }[];
  for (const c of champs) {
    if (texte.includes(c.nom.toLowerCase())) {
      propositions.push({ entite_carte: "champ", systeme: c.systeme_nom, module: c.module_nom, nom: c.nom });
    }
  }

  const modules = db
    .prepare(`SELECT m.nom, s.nom AS systeme_nom FROM modules m JOIN systemes s ON s.id = m.systeme_id`)
    .all() as { nom: string; systeme_nom: string }[];
  for (const m of modules) {
    if (texte.includes(m.nom.toLowerCase())) {
      propositions.push({ entite_carte: "module", systeme: m.systeme_nom, nom: m.nom });
    }
  }

  const integrations = db.prepare("SELECT nom FROM integrations").all() as { nom: string }[];
  for (const i of integrations) {
    if (texte.includes(i.nom.toLowerCase())) {
      propositions.push({ entite_carte: "integration", nom: i.nom });
    }
  }

  const automatisations = db.prepare("SELECT nom FROM automatisations").all() as { nom: string }[];
  for (const a of automatisations) {
    if (texte.includes(a.nom.toLowerCase())) {
      propositions.push({ entite_carte: "automatisation", nom: a.nom });
    }
  }

  return propositions;
}
