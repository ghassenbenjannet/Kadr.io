// Agrégation pour l'écran d'accueil "Aujourd'hui" (GET /api/tableau-de-bord) :
// quatre compteurs, le journal des 7 derniers jours, et les constats ouverts
// (vigie) — tout est recalculé à la lecture, rien n'est mis en cache.

import type Database from "better-sqlite3";
import { listerJournal, type LigneJournal } from "./journal.js";
import { constatsOuverts } from "../tools/constats-ouverts.js";

const STATUTS_DEMANDE_EN_ATTENTE = ["recue", "qualifiee", "arbitree"];

export interface TableauDeBord {
  demandesEnAttente: number;
  constatsOuverts: number;
  changements7j: number;
  incidentsOuverts: number;
  journalSemaine: LigneJournal[];
  vigie: { controle: string; resume: string; consequence: string }[];
  resumeSemaine: { demandes: number; decisions: number; changements: number; incidentsClos: number };
}

function ilYA7Jours(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString();
}

export function detailTableauDeBord(db: Database.Database): TableauDeBord {
  const depuis = ilYA7Jours();

  const placeholders = STATUTS_DEMANDE_EN_ATTENTE.map(() => "?").join(",");
  const demandesEnAttente = (
    db.prepare(`SELECT COUNT(*) AS n FROM demandes WHERE statut IN (${placeholders})`).get(
      ...STATUTS_DEMANDE_EN_ATTENTE
    ) as { n: number }
  ).n;

  const constats = constatsOuverts(db, {});
  const nbConstatsOuverts = constats.ok ? constats.constats.length : 0;

  const changements7j = (
    db.prepare("SELECT COUNT(*) AS n FROM changements WHERE cree_le >= ?").get(depuis) as { n: number }
  ).n;

  const incidentsOuverts = (
    db.prepare("SELECT COUNT(*) AS n FROM incidents WHERE resolu_le IS NULL").get() as { n: number }
  ).n;

  const journalSemaine = listerJournal(db, { depuis }).slice(0, 8);

  const vigie = constats.ok
    ? constats.constats.slice(0, 3).map((c) => ({ controle: c.controle, resume: c.resume, consequence: c.consequence }))
    : [];

  const decisionsSemaine = (
    db.prepare("SELECT COUNT(*) AS n FROM decisions WHERE cree_le >= ?").get(depuis) as { n: number }
  ).n;
  const incidentsClosSemaine = (
    db.prepare("SELECT COUNT(*) AS n FROM incidents WHERE resolu_le >= ?").get(depuis) as { n: number }
  ).n;
  const demandesSemaine = (
    db.prepare("SELECT COUNT(*) AS n FROM demandes WHERE cree_le >= ?").get(depuis) as { n: number }
  ).n;

  return {
    demandesEnAttente,
    constatsOuverts: nbConstatsOuverts,
    changements7j,
    incidentsOuverts,
    journalSemaine,
    vigie,
    resumeSemaine: {
      demandes: demandesSemaine,
      decisions: decisionsSemaine,
      changements: changements7j,
      incidentsClos: incidentsClosSemaine,
    },
  };
}
