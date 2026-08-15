import type Database from "better-sqlite3";

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  const jour = String(d.getUTCDate()).padStart(2, "0");
  const mois = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}`;
}

export interface DetailEntite {
  date: string;
  libelle: string;
}

/** Résout une entité du journal (entite + id) en une phrase lisible et sa date de création. */
export function detailEntite(db: Database.Database, entite: string, id: string): DetailEntite | null {
  switch (entite) {
    case "demande": {
      const row = db
        .prepare("SELECT cree_le, demandeur, equipe FROM demandes WHERE id = ?")
        .get(id) as { cree_le: string; demandeur: string; equipe: string } | undefined;
      if (!row) return null;
      return {
        date: row.cree_le,
        libelle: `demande du ${formatDateFr(row.cree_le)} : ${row.demandeur} (${row.equipe})`,
      };
    }
    case "decision": {
      const row = db.prepare("SELECT cree_le, decision FROM decisions WHERE id = ?").get(id) as
        | { cree_le: string; decision: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, libelle: `décision du ${formatDateFr(row.cree_le)} : ${row.decision}` };
    }
    case "changement": {
      const row = db
        .prepare("SELECT cree_le, description FROM changements WHERE id = ?")
        .get(id) as { cree_le: string; description: string } | undefined;
      if (!row) return null;
      return {
        date: row.cree_le,
        libelle: `changement du ${formatDateFr(row.cree_le)} : ${row.description}`,
      };
    }
    case "incident": {
      const row = db.prepare("SELECT cree_le, symptome FROM incidents WHERE id = ?").get(id) as
        | { cree_le: string; symptome: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, libelle: `incident du ${formatDateFr(row.cree_le)} : ${row.symptome}` };
    }
    case "systeme": {
      const row = db.prepare("SELECT cree_le, nom FROM systemes WHERE id = ?").get(id) as
        | { cree_le: string; nom: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, libelle: `système « ${row.nom} »` };
    }
    case "module": {
      const row = db
        .prepare(
          `SELECT m.cree_le, m.nom, s.nom AS systeme_nom FROM modules m
           JOIN systemes s ON s.id = m.systeme_id WHERE m.id = ?`
        )
        .get(id) as { cree_le: string; nom: string; systeme_nom: string } | undefined;
      if (!row) return null;
      return { date: row.cree_le, libelle: `module « ${row.nom} » (${row.systeme_nom})` };
    }
    case "champ": {
      const row = db
        .prepare(
          `SELECT c.cree_le, c.nom, m.nom AS module_nom FROM champs c
           JOIN modules m ON m.id = c.module_id WHERE c.id = ?`
        )
        .get(id) as { cree_le: string; nom: string; module_nom: string } | undefined;
      if (!row) return null;
      return { date: row.cree_le, libelle: `champ « ${row.nom} » (${row.module_nom})` };
    }
    case "habilitation": {
      const row = db
        .prepare(
          `SELECT h.cree_le, h.profil, c.nom AS champ_nom FROM habilitations h
           JOIN champs c ON c.id = h.champ_id WHERE h.id = ?`
        )
        .get(id) as { cree_le: string; profil: string; champ_nom: string } | undefined;
      if (!row) return null;
      return {
        date: row.cree_le,
        libelle: `habilitation ${row.profil} × « ${row.champ_nom} »`,
      };
    }
    case "integration": {
      const row = db.prepare("SELECT cree_le, nom FROM integrations WHERE id = ?").get(id) as
        | { cree_le: string; nom: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, libelle: `intégration « ${row.nom} »` };
    }
    case "automatisation": {
      const row = db.prepare("SELECT cree_le, nom FROM automatisations WHERE id = ?").get(id) as
        | { cree_le: string; nom: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, libelle: `automatisation « ${row.nom} »` };
    }
    case "erreur_integration": {
      // erreurs_integration n'a pas de cree_le (voir schéma §2 jalon 2) : on utilise maj_le.
      const row = db
        .prepare(
          `SELECT e.maj_le, e.titre, i.nom AS integration_nom FROM erreurs_integration e
           JOIN integrations i ON i.id = e.integration_id WHERE e.id = ?`
        )
        .get(id) as { maj_le: string; titre: string; integration_nom: string } | undefined;
      if (!row) return null;
      return {
        date: row.maj_le,
        libelle: `erreur « ${row.titre} » (intégration ${row.integration_nom})`,
      };
    }
    case "metrique": {
      // metriques n'a pas de cree_le (voir schéma §2 jalon 2) : on utilise maj_le.
      const row = db
        .prepare(
          `SELECT m.maj_le, m.nom, i.nom AS integration_nom FROM metriques m
           JOIN integrations i ON i.id = m.integration_id WHERE m.id = ?`
        )
        .get(id) as { maj_le: string; nom: string; integration_nom: string } | undefined;
      if (!row) return null;
      return {
        date: row.maj_le,
        libelle: `métrique « ${row.nom} » (intégration ${row.integration_nom})`,
      };
    }
    default:
      return null;
  }
}
