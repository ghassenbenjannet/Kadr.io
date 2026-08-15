import type Database from "better-sqlite3";
import { detailEntite } from "../db/libelles.js";

interface SystemeLigne {
  nom: string;
  role: string;
  criticite: string;
  editeur: string | null;
}

interface ModuleLigne {
  systeme: string;
  module: string;
  champsTotal: number;
  champsCouverts: number;
}

interface IntegrationLigne {
  nom: string;
  source: string;
  cible: string;
  constatsOuverts: number;
}

interface ConstatLigne {
  famille: "pratique" | "modele" | "integration";
  resume: string;
  consequence: string;
}

export interface DonneesEtatSi {
  systemes: SystemeLigne[];
  modules: ModuleLigne[];
  integrations: IntegrationLigne[];
  constats: ConstatLigne[];
}

function familleDuControle(controle: string): "pratique" | "modele" | "integration" {
  if (controle.startsWith("C")) return "pratique";
  if (controle.startsWith("M")) return "modele";
  return "integration";
}

export function collecterDonneesEtatSi(db: Database.Database): DonneesEtatSi {
  const systemes = db
    .prepare("SELECT nom, role, criticite, editeur FROM systemes ORDER BY nom")
    .all() as SystemeLigne[];

  const modulesRows = db
    .prepare(
      `SELECT m.nom AS module, s.nom AS systeme,
              (SELECT COUNT(*) FROM champs c WHERE c.module_id = m.id) AS champsTotal,
              (SELECT COUNT(*) FROM champs c WHERE c.module_id = m.id AND c.source_de_verite IS NOT NULL) AS champsCouverts
       FROM modules m JOIN systemes s ON s.id = m.systeme_id
       ORDER BY s.nom, m.nom`
    )
    .all() as ModuleLigne[];

  const integrationsRows = db
    .prepare(
      `SELECT i.nom, so.nom AS source, ci.nom AS cible,
              (SELECT COUNT(*) FROM constats co WHERE co.entite = 'integration' AND co.entite_id = i.id AND co.statut = 'ouvert') AS constatsOuverts
       FROM integrations i
       JOIN systemes so ON so.id = i.source_id
       JOIN systemes ci ON ci.id = i.cible_id
       ORDER BY i.nom`
    )
    .all() as IntegrationLigne[];

  const constatsRows = db
    .prepare(
      "SELECT controle, entite, entite_id, consequence FROM constats WHERE statut = 'ouvert' ORDER BY controle, cree_le"
    )
    .all() as { controle: string; entite: string; entite_id: string; consequence: string }[];

  const constats: ConstatLigne[] = constatsRows.map((c) => ({
    famille: familleDuControle(c.controle),
    resume: detailEntite(db, c.entite, c.entite_id)?.libelle ?? `${c.entite} ${c.entite_id}`,
    consequence: c.consequence,
  }));

  return { systemes, modules: modulesRows, integrations: integrationsRows, constats };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateDuJour(maintenant: Date): string {
  return `${pad2(maintenant.getUTCDate())}/${pad2(maintenant.getUTCMonth() + 1)}/${maintenant.getUTCFullYear()}`;
}

export function rendreEtatSi(donnees: DonneesEtatSi, maintenant = new Date()): string {
  const lignes: string[] = [];

  lignes.push(`# État du SI — ${dateDuJour(maintenant)}`);
  lignes.push("");

  lignes.push("## Systèmes");
  if (donnees.systemes.length === 0) {
    lignes.push("Aucun système décrit pour l'instant.");
  } else {
    for (const s of donnees.systemes) {
      const editeur = s.editeur ? `, éditeur ${s.editeur}` : "";
      lignes.push(`— ${s.nom} (criticité ${s.criticite}${editeur}) : ${s.role}`);
    }
  }
  lignes.push("");

  lignes.push("## Modules et couverture");
  if (donnees.modules.length === 0) {
    lignes.push("Aucun module décrit pour l'instant.");
  } else {
    for (const m of donnees.modules) {
      const nonCouverts = m.champsTotal - m.champsCouverts;
      lignes.push(
        `— ${m.systeme} / ${m.module} : ${m.champsTotal} champ(s) décrit(s), ${m.champsCouverts} avec source de vérité, ${nonCouverts} sans`
      );
    }
  }
  lignes.push("");

  lignes.push("## Intégrations");
  if (donnees.integrations.length === 0) {
    lignes.push("Aucune intégration décrite pour l'instant.");
  } else {
    for (const i of donnees.integrations) {
      const etat = i.constatsOuverts === 0 ? "aucun point de vigilance ouvert" : `${i.constatsOuverts} point(s) de vigilance ouvert(s)`;
      lignes.push(`— ${i.nom} (${i.source} → ${i.cible}) : ${etat}`);
    }
  }
  lignes.push("");

  lignes.push("## Constats ouverts par famille");
  const familles: Array<{ cle: ConstatLigne["famille"]; titre: string }> = [
    { cle: "pratique", titre: "Journal" },
    { cle: "modele", titre: "Modèle" },
    { cle: "integration", titre: "Intégration" },
  ];
  const auMoinsUnConstat = donnees.constats.length > 0;
  if (!auMoinsUnConstat) {
    lignes.push("Aucun constat ouvert.");
  } else {
    for (const f of familles) {
      const constatsFamille = donnees.constats.filter((c) => c.famille === f.cle);
      if (constatsFamille.length === 0) continue;
      lignes.push(`### ${f.titre}`);
      for (const c of constatsFamille) {
        lignes.push(`— ${c.resume} : ${c.consequence}`);
      }
    }
  }

  return lignes.join("\n") + "\n";
}

export function genererRapportEtatSi(db: Database.Database, maintenant = new Date()): string {
  return rendreEtatSi(collecterDonneesEtatSi(db), maintenant);
}
