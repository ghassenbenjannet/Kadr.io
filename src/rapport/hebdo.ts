import type Database from "better-sqlite3";
import { detailEntite } from "../db/libelles.js";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function semaineCouranteIso(maintenant = new Date()): string {
  const { annee, semaine } = semaineIso(maintenant);
  return `${annee}-W${pad2(semaine)}`;
}

function semaineIso(date: Date): { annee: number; semaine: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const jourSemaine = d.getUTCDay() || 7; // lundi=1 .. dimanche=7
  d.setUTCDate(d.getUTCDate() + 4 - jourSemaine);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((d.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7);
  return { annee: d.getUTCFullYear(), semaine };
}

function lundiDeSemaineIso(annee: number, semaine: number): Date {
  const jan4 = new Date(Date.UTC(annee, 0, 4));
  const jourJan4 = jan4.getUTCDay() || 7;
  const lundiSemaine1 = new Date(jan4);
  lundiSemaine1.setUTCDate(jan4.getUTCDate() - jourJan4 + 1);
  const lundi = new Date(lundiSemaine1);
  lundi.setUTCDate(lundiSemaine1.getUTCDate() + (semaine - 1) * 7);
  return lundi;
}

export function bornesSemaine(semaineIsoStr: string): { debut: Date; fin: Date } {
  const m = /^(\d{4})-W(\d{2})$/.exec(semaineIsoStr);
  if (!m || !m[1] || !m[2]) {
    throw new Error(`Format de semaine invalide (attendu AAAA-Www) : ${semaineIsoStr}`);
  }
  const annee = Number(m[1]);
  const semaine = Number(m[2]);
  const debut = lundiDeSemaineIso(annee, semaine);
  const fin = new Date(debut);
  fin.setUTCDate(debut.getUTCDate() + 7);
  return { debut, fin };
}

function formatDateComplete(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function ageEnJours(creeLe: string, maintenant: Date): number {
  return Math.floor((maintenant.getTime() - new Date(creeLe).getTime()) / 86400000);
}

interface DemandeAttente {
  demandeur: string;
  equipe: string;
  texte: string;
  jours: number;
}

interface ChangementLigne {
  date: string;
  type: string;
  description: string;
  sansRollback: boolean;
}

interface IncidentLigne {
  symptome: string;
  impact: string;
  dureeHeures: number | null;
}

interface VigilanceLigne {
  controle: string;
  resume: string;
  consequence: string;
}

interface AnnulationLigne {
  entite: string;
  resume: string;
  raison: string;
}

interface ProchaineDemande {
  demandeur: string;
  equipe: string;
  texte: string;
}

interface ProchaineDecision {
  decision: string;
}

interface CarteEtElementsDecrits {
  systemes: number;
  modules: number;
  champs: number;
  habilitations: number;
  integrations: number;
  automatisations: number;
}

export interface DonneesHebdo {
  semaine: string;
  demandes: {
    recues: number;
    parEquipe: Record<string, number>;
    traitees: number;
    enAttente: DemandeAttente[];
  };
  changements: ChangementLigne[];
  incidents: IncidentLigne[];
  vigilance: VigilanceLigne[];
  /** §Prompt L : annulées cette semaine, gardées visibles pour ne pas silencier un constat. */
  annulations: AnnulationLigne[];
  semaineProchaine: {
    demandesArbitrees: ProchaineDemande[];
    decisionsValidees: ProchaineDecision[];
  };
  carte: {
    elementsDecrits: CarteEtElementsDecrits;
    nouveauxConstatsMI: VigilanceLigne[];
  };
}

const ENTITES_JOURNAL: { entite: string; table: string }[] = [
  { entite: "demande", table: "demandes" },
  { entite: "decision", table: "decisions" },
  { entite: "changement", table: "changements" },
  { entite: "incident", table: "incidents" },
];

function collecterAnnulations(db: Database.Database, debutIso: string, finIso: string): AnnulationLigne[] {
  const resultats: AnnulationLigne[] = [];
  for (const { entite, table } of ENTITES_JOURNAL) {
    const rows = db
      .prepare(`SELECT id, annulation_raison FROM ${table} WHERE annule_le >= ? AND annule_le < ? ORDER BY annule_le`)
      .all(debutIso, finIso) as { id: string; annulation_raison: string | null }[];
    for (const r of rows) {
      resultats.push({
        entite,
        resume: detailEntite(db, entite, r.id)?.libelle ?? `${entite} ${r.id}`,
        raison: r.annulation_raison ?? "",
      });
    }
  }
  return resultats;
}

export function collecterDonneesHebdo(
  db: Database.Database,
  semaineIsoStr: string,
  maintenant = new Date()
): DonneesHebdo {
  const { debut, fin } = bornesSemaine(semaineIsoStr);
  const debutIso = debut.toISOString();
  const finIso = fin.toISOString();

  const demandesRecues = db
    .prepare("SELECT equipe FROM demandes WHERE cree_le >= ? AND cree_le < ? AND annule_le IS NULL")
    .all(debutIso, finIso) as { equipe: string }[];

  const parEquipe: Record<string, number> = {};
  for (const d of demandesRecues) {
    parEquipe[d.equipe] = (parEquipe[d.equipe] ?? 0) + 1;
  }

  const traitees = db
    .prepare(
      "SELECT COUNT(*) AS n FROM demandes WHERE statut = 'realisee' AND maj_le >= ? AND maj_le < ? AND annule_le IS NULL"
    )
    .get(debutIso, finIso) as { n: number };

  const enAttenteRows = db
    .prepare(
      "SELECT demandeur, equipe, expression_brute, reformulation, cree_le FROM demandes WHERE statut IN ('recue','qualifiee') AND annule_le IS NULL ORDER BY cree_le"
    )
    .all() as {
    demandeur: string;
    equipe: string;
    expression_brute: string;
    reformulation: string | null;
    cree_le: string;
  }[];

  const enAttente: DemandeAttente[] = enAttenteRows.map((d) => ({
    demandeur: d.demandeur,
    equipe: d.equipe,
    texte: d.reformulation ?? d.expression_brute,
    jours: ageEnJours(d.cree_le, maintenant),
  }));

  const changementsRows = db
    .prepare(
      "SELECT cree_le, type, description, rollback FROM changements WHERE cree_le >= ? AND cree_le < ? AND annule_le IS NULL ORDER BY cree_le"
    )
    .all(debutIso, finIso) as { cree_le: string; type: string; description: string; rollback: string | null }[];

  const changements: ChangementLigne[] = changementsRows.map((c) => ({
    date: c.cree_le,
    type: c.type,
    description: c.description,
    sansRollback: c.rollback === null,
  }));

  const incidentsRows = db
    .prepare(
      "SELECT symptome, impact, cree_le, resolu_le FROM incidents WHERE cree_le >= ? AND cree_le < ? AND annule_le IS NULL ORDER BY cree_le"
    )
    .all(debutIso, finIso) as { symptome: string; impact: string; cree_le: string; resolu_le: string | null }[];

  const incidents: IncidentLigne[] = incidentsRows.map((i) => ({
    symptome: i.symptome,
    impact: i.impact,
    dureeHeures: i.resolu_le
      ? Math.round((new Date(i.resolu_le).getTime() - new Date(i.cree_le).getTime()) / 3600000)
      : null,
  }));

  const constatsRows = db
    .prepare(
      "SELECT controle, entite, entite_id, consequence FROM constats WHERE statut = 'ouvert' ORDER BY controle, cree_le"
    )
    .all() as { controle: string; entite: string; entite_id: string; consequence: string }[];

  const vigilance: VigilanceLigne[] = constatsRows.map((c) => ({
    controle: c.controle,
    resume: detailEntite(db, c.entite, c.entite_id)?.libelle ?? `${c.entite} ${c.entite_id}`,
    consequence: c.consequence,
  }));

  const demandesArbitreesRows = db
    .prepare(
      "SELECT demandeur, equipe, expression_brute, reformulation FROM demandes WHERE statut = 'arbitree' AND annule_le IS NULL ORDER BY cree_le"
    )
    .all() as { demandeur: string; equipe: string; expression_brute: string; reformulation: string | null }[];

  const decisionsValideesRows = db
    .prepare("SELECT decision FROM decisions WHERE statut = 'validee' AND annule_le IS NULL ORDER BY cree_le")
    .all() as { decision: string }[];

  function compterCreesCetteSemaine(table: string): number {
    const r = db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE cree_le >= ? AND cree_le < ?`)
      .get(debutIso, finIso) as { n: number };
    return r.n;
  }

  const elementsDecrits: CarteEtElementsDecrits = {
    systemes: compterCreesCetteSemaine("systemes"),
    modules: compterCreesCetteSemaine("modules"),
    champs: compterCreesCetteSemaine("champs"),
    habilitations: compterCreesCetteSemaine("habilitations"),
    integrations: compterCreesCetteSemaine("integrations"),
    automatisations: compterCreesCetteSemaine("automatisations"),
  };

  const nouveauxConstatsMIRows = db
    .prepare(
      `SELECT controle, entite, entite_id, consequence FROM constats
       WHERE statut = 'ouvert' AND controle NOT LIKE 'C%' AND cree_le >= ? AND cree_le < ?
       ORDER BY controle, cree_le`
    )
    .all(debutIso, finIso) as { controle: string; entite: string; entite_id: string; consequence: string }[];

  const nouveauxConstatsMI: VigilanceLigne[] = nouveauxConstatsMIRows.map((c) => ({
    controle: c.controle,
    resume: detailEntite(db, c.entite, c.entite_id)?.libelle ?? `${c.entite} ${c.entite_id}`,
    consequence: c.consequence,
  }));

  return {
    semaine: semaineIsoStr,
    demandes: {
      recues: demandesRecues.length,
      parEquipe,
      traitees: traitees.n,
      enAttente,
    },
    changements,
    incidents,
    vigilance,
    annulations: collecterAnnulations(db, debutIso, finIso),
    semaineProchaine: {
      demandesArbitrees: demandesArbitreesRows.map((d) => ({
        demandeur: d.demandeur,
        equipe: d.equipe,
        texte: d.reformulation ?? d.expression_brute,
      })),
      decisionsValidees: decisionsValideesRows.map((d) => ({ decision: d.decision })),
    },
    carte: { elementsDecrits, nouveauxConstatsMI },
  };
}

export function rendreHebdo(donnees: DonneesHebdo): string {
  const lignes: string[] = [];

  lignes.push(`# Revue SI — semaine ${donnees.semaine}`);
  lignes.push("");

  lignes.push("## Demandes");
  const repartition =
    Object.entries(donnees.demandes.parEquipe)
      .map(([equipe, n]) => `${equipe} : ${n}`)
      .join(", ") || "aucune";
  lignes.push(
    `${donnees.demandes.recues} reçues (${repartition}), ${donnees.demandes.traitees} traitées, ${donnees.demandes.enAttente.length} en attente`
  );
  for (const d of donnees.demandes.enAttente) {
    lignes.push(`— ${d.demandeur} (${d.equipe}) : ${d.texte}, depuis ${d.jours} j`);
  }
  lignes.push("");

  lignes.push("## Changements en production");
  if (donnees.changements.length === 0) {
    lignes.push("Aucun changement mis en production cette semaine.");
  } else {
    for (const c of donnees.changements) {
      const avertissement = c.sansRollback ? " ⚠ sans rollback" : "";
      lignes.push(`— ${formatDateComplete(c.date)} · ${c.type} · ${c.description}${avertissement}`);
    }
  }
  lignes.push("");

  lignes.push("## Incidents");
  if (donnees.incidents.length === 0) {
    lignes.push("Aucun incident cette semaine.");
  } else {
    for (const i of donnees.incidents) {
      const statut = i.dureeHeures === null ? "en cours" : `résolu en ${i.dureeHeures}h`;
      lignes.push(`— ${i.symptome} · impact : ${i.impact} · ${statut}`);
    }
  }
  lignes.push("");

  lignes.push("## Points de vigilance");
  if (donnees.vigilance.length === 0) {
    lignes.push("Aucun point de vigilance ouvert.");
  } else {
    for (const v of donnees.vigilance) {
      lignes.push(`— ${v.resume} : ${v.consequence}`);
    }
  }
  lignes.push("");

  lignes.push("## Entrées annulées cette semaine");
  if (donnees.annulations.length === 0) {
    lignes.push("Aucune entrée annulée cette semaine.");
  } else {
    for (const a of donnees.annulations) {
      lignes.push(`— [${a.entite}] ${a.resume} — motif : ${a.raison}`);
    }
  }
  lignes.push("");

  lignes.push("## Semaine prochaine");
  const { demandesArbitrees, decisionsValidees } = donnees.semaineProchaine;
  if (demandesArbitrees.length === 0 && decisionsValidees.length === 0) {
    lignes.push("Rien de prévu pour la semaine prochaine.");
  } else {
    for (const d of demandesArbitrees) {
      lignes.push(`— Demande arbitrée à réaliser : ${d.texte} (${d.demandeur}, ${d.equipe})`);
    }
    for (const d of decisionsValidees) {
      lignes.push(`— Décision validée à appliquer : ${d.decision}`);
    }
  }
  lignes.push("");

  lignes.push("## Carte");
  const { elementsDecrits, nouveauxConstatsMI } = donnees.carte;
  const totalElements = Object.values(elementsDecrits).reduce((a, b) => a + b, 0);
  if (totalElements === 0) {
    lignes.push("Aucun nouvel élément cartographié cette semaine.");
  } else {
    lignes.push(
      `${totalElements} élément(s) décrit(s) ou complété(s) cette semaine ` +
        `(systèmes : ${elementsDecrits.systemes}, modules : ${elementsDecrits.modules}, ` +
        `champs : ${elementsDecrits.champs}, habilitations : ${elementsDecrits.habilitations}, ` +
        `intégrations : ${elementsDecrits.integrations}, automatisations : ${elementsDecrits.automatisations})`
    );
  }
  if (nouveauxConstatsMI.length === 0) {
    lignes.push("Aucun nouveau point de vigilance sur le modèle ou les intégrations cette semaine.");
  } else {
    for (const v of nouveauxConstatsMI) {
      lignes.push(`— ${v.resume} : ${v.consequence}`);
    }
  }

  return lignes.join("\n") + "\n";
}

export function genererRapportHebdo(db: Database.Database, semaineIsoStr?: string): string {
  const semaine = semaineIsoStr ?? semaineCouranteIso();
  const donnees = collecterDonneesHebdo(db, semaine);
  return rendreHebdo(donnees);
}
