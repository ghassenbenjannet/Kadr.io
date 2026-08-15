import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";
import { creerProjet } from "../src/tools/creer-projet.js";
import { creerEpic } from "../src/tools/creer-epic.js";
import { creerTicket } from "../src/tools/creer-ticket.js";
import { mettreAJourTicket } from "../src/tools/mettre-a-jour-ticket.js";
import { creerPlanTest } from "../src/tools/creer-plan-test.js";
import { executerCasTest } from "../src/tools/executer-cas-test.js";
import { lierTicketPlanTest } from "../src/tools/lier-ticket-plan-test.js";
import { etatProjet } from "../src/tools/etat-projet.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("creer_projet", () => {
  it("crée un projet, éventuellement lié à une ou plusieurs demandes", () => {
    contexte = creerDbTemp();
    const demande1 = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "on veut une vue 360",
      type: "evolution",
    });
    const demande2 = enregistrerDemande(contexte.db, {
      demandeur: "Marc",
      equipe: "ADV",
      expression_brute: "on veut exporter les commandes",
      type: "evolution",
    });
    expect(demande1.ok).toBe(true);
    expect(demande2.ok).toBe(true);
    if (!demande1.ok || !demande2.ok) return;

    const r = creerProjet(contexte.db, { nom: "CS-Vue360", demande_ids: [demande1.id, demande2.id] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const statut = contexte.db.prepare("SELECT statut FROM projets WHERE nom = ?").get("CS-Vue360") as {
      statut: string;
    };
    expect(statut.statut).toBe("actif");

    const liens = contexte.db
      .prepare("SELECT demande_id FROM projet_demandes WHERE projet_id = ? ORDER BY demande_id")
      .all(r.id) as { demande_id: string }[];
    expect(liens.map((l) => l.demande_id).sort()).toEqual([demande1.id, demande2.id].sort());
  });

  it("refuse une demande_id inconnue", () => {
    contexte = creerDbTemp();
    const r = creerProjet(contexte.db, { nom: "Projet X", demande_ids: ["inconnue"] });
    expect(r.ok).toBe(false);
  });

  it("rappeler avec un nouveau demande_id sur un projet existant ajoute le lien sans retirer les précédents", () => {
    contexte = creerDbTemp();
    const demande1 = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "x",
      type: "evolution",
    });
    const demande2 = enregistrerDemande(contexte.db, {
      demandeur: "Marc",
      equipe: "ADV",
      expression_brute: "y",
      type: "evolution",
    });
    if (!demande1.ok || !demande2.ok) throw new Error("échec de seed");

    const r1 = creerProjet(contexte.db, { nom: "Projet Y", demande_ids: [demande1.id] });
    if (!r1.ok) throw new Error("échec création");
    creerProjet(contexte.db, { nom: "Projet Y", demande_ids: [demande2.id] });

    const liens = contexte.db.prepare("SELECT COUNT(*) AS n FROM projet_demandes WHERE projet_id = ?").get(r1.id) as {
      n: number;
    };
    expect(liens.n).toBe(2);
  });

  it("upsert par nom : un second appel met à jour plutôt que dupliquer", () => {
    contexte = creerDbTemp();
    creerProjet(contexte.db, { nom: "Projet X" });
    creerProjet(contexte.db, { nom: "Projet X", description: "précisé plus tard" });

    const lignes = contexte.db.prepare("SELECT COUNT(*) AS n FROM projets WHERE nom = ?").get("Projet X") as {
      n: number;
    };
    expect(lignes.n).toBe(1);
    const ligne = contexte.db.prepare("SELECT description FROM projets WHERE nom = ?").get("Projet X") as {
      description: string;
    };
    expect(ligne.description).toBe("précisé plus tard");
  });
});

describe("creer_epic", () => {
  it("crée le projet automatiquement si absent, avec avertissement", () => {
    contexte = creerDbTemp();
    const r = creerEpic(contexte.db, { projet: "Projet Y", nom: "Discovery" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.avertissements.length).toBeGreaterThan(0);

    const projet = contexte.db.prepare("SELECT id FROM projets WHERE nom = ?").get("Projet Y");
    expect(projet).toBeDefined();
  });

  it("deux epics de même nom dans deux projets différents ne se confondent pas", () => {
    contexte = creerDbTemp();
    const e1 = creerEpic(contexte.db, { projet: "Projet A", nom: "Discovery" });
    const e2 = creerEpic(contexte.db, { projet: "Projet B", nom: "Discovery" });
    expect(e1.ok).toBe(true);
    expect(e2.ok).toBe(true);
    if (!e1.ok || !e2.ok) return;
    expect(e1.id).not.toBe(e2.id);
  });
});

describe("creer_ticket", () => {
  it("crée un ticket typé dans un epic, en cascade si besoin", () => {
    contexte = creerDbTemp();
    const r = creerTicket(contexte.db, {
      projet: "CS-Vue360",
      epic: "Discovery",
      titre: "Atelier besoins CS",
      type: "atelier",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const ligne = contexte.db.prepare("SELECT type, statut FROM tickets WHERE id = ?").get(r.id) as {
      type: string;
      statut: string;
    };
    expect(ligne.type).toBe("atelier");
    expect(ligne.statut).toBe("a_faire");
  });

  it("deux tickets peuvent partager le même titre", () => {
    contexte = creerDbTemp();
    const r1 = creerTicket(contexte.db, { projet: "P", epic: "E", titre: "Bug", type: "bug" });
    const r2 = creerTicket(contexte.db, { projet: "P", epic: "E", titre: "Bug", type: "bug" });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.id).not.toBe(r2.id);
  });
});

describe("mettre_a_jour_ticket", () => {
  it("fait avancer le statut", () => {
    contexte = creerDbTemp();
    const ticket = creerTicket(contexte.db, { projet: "P", epic: "E", titre: "T", type: "task" });
    expect(ticket.ok).toBe(true);
    if (!ticket.ok) return;

    const r = mettreAJourTicket(contexte.db, { id: ticket.id, statut: "en_cours" });
    expect(r.ok).toBe(true);
    const ligne = contexte.db.prepare("SELECT statut FROM tickets WHERE id = ?").get(ticket.id) as {
      statut: string;
    };
    expect(ligne.statut).toBe("en_cours");
  });

  it("refuse un ticket introuvable", () => {
    contexte = creerDbTemp();
    const r = mettreAJourTicket(contexte.db, { id: "inconnu", statut: "termine" });
    expect(r.ok).toBe(false);
  });
});

describe("creer_plan_test / executer_cas_test / lier_ticket_plan_test", () => {
  it("crée un plan avec ses cas, tous à_faire au départ", () => {
    contexte = creerDbTemp();
    const r = creerPlanTest(contexte.db, {
      nom: "Recette Vue360",
      cas: [
        { etape: "Ouvrir la fiche client", resultat_attendu: "Le bloc Vue360 s'affiche" },
        { etape: "Cliquer sur une facture", resultat_attendu: "Le détail s'ouvre" },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cas_ids.length).toBe(2);

    const cas = contexte.db.prepare("SELECT statut FROM cas_test WHERE plan_test_id = ?").all(r.id) as {
      statut: string;
    }[];
    expect(cas.every((c) => c.statut === "a_faire")).toBe(true);
  });

  it("refuse un nom de plan déjà pris", () => {
    contexte = creerDbTemp();
    creerPlanTest(contexte.db, { nom: "Recette X", cas: [{ etape: "a", resultat_attendu: "b" }] });
    const r = creerPlanTest(contexte.db, { nom: "Recette X", cas: [{ etape: "c", resultat_attendu: "d" }] });
    expect(r.ok).toBe(false);
  });

  it("exécute un cas et enregistre qui l'a joué", () => {
    contexte = creerDbTemp();
    const plan = creerPlanTest(contexte.db, {
      nom: "Recette Y",
      cas: [{ etape: "Exporter", resultat_attendu: "CSV généré" }],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const r = executerCasTest(contexte.db, { id: plan.cas_ids[0]!, statut: "reussi", executee_par: "Sophie" });
    expect(r.ok).toBe(true);

    const ligne = contexte.db.prepare("SELECT statut, executee_par, executee_le FROM cas_test WHERE id = ?").get(
      plan.cas_ids[0]!
    ) as { statut: string; executee_par: string; executee_le: string | null };
    expect(ligne.statut).toBe("reussi");
    expect(ligne.executee_par).toBe("Sophie");
    expect(ligne.executee_le).not.toBeNull();
  });

  it("lie un ticket à un plan de test, la suite de recette du projet le reflète", () => {
    contexte = creerDbTemp();
    const ticket = creerTicket(contexte.db, {
      projet: "CS-Vue360",
      epic: "Build",
      titre: "Développer export",
      type: "task",
    });
    expect(ticket.ok).toBe(true);
    if (!ticket.ok) return;

    const plan = creerPlanTest(contexte.db, {
      nom: "Recette export",
      cas: [
        { etape: "Exporter", resultat_attendu: "CSV" },
        { etape: "Vérifier colonnes", resultat_attendu: "5 colonnes" },
      ],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const lien = lierTicketPlanTest(contexte.db, { ticket_id: ticket.id, plan_test: "Recette export" });
    expect(lien.ok).toBe(true);

    executerCasTest(contexte.db, { id: plan.cas_ids[0]!, statut: "reussi" });
    executerCasTest(contexte.db, { id: plan.cas_ids[1]!, statut: "echoue" });

    const etat = etatProjet(contexte.db, { projet: "CS-Vue360" });
    expect(etat.ok).toBe(true);
    if (!etat.ok || !("suite_recette" in etat)) return;
    expect(etat.suite_recette).toEqual([
      { nom: "Recette export", cas_total: 2, reussis: 1, echoues: 1, a_faire: 0 },
    ]);
  });

  it("relier deux fois ne duplique pas le lien", () => {
    contexte = creerDbTemp();
    const ticket = creerTicket(contexte.db, { projet: "P", epic: "E", titre: "T", type: "task" });
    const plan = creerPlanTest(contexte.db, { nom: "Plan Z", cas: [{ etape: "a", resultat_attendu: "b" }] });
    if (!ticket.ok || !plan.ok) return;

    lierTicketPlanTest(contexte.db, { ticket_id: ticket.id, plan_test: "Plan Z" });
    lierTicketPlanTest(contexte.db, { ticket_id: ticket.id, plan_test: "Plan Z" });

    const lignes = contexte.db
      .prepare("SELECT COUNT(*) AS n FROM ticket_plans_test WHERE ticket_id = ?")
      .get(ticket.id) as { n: number };
    expect(lignes.n).toBe(1);
  });
});

describe("etat_projet", () => {
  it("sans paramètre, liste tous les projets avec un résumé", () => {
    contexte = creerDbTemp();
    creerTicket(contexte.db, { projet: "Projet 1", epic: "E1", titre: "T1", type: "task" });
    const r = etatProjet(contexte.db, {});
    expect(r.ok).toBe(true);
    if (!r.ok || !("projets" in r)) return;
    expect(r.projets.length).toBe(1);
    expect(r.projets[0]!.nom).toBe("Projet 1");
    expect(r.projets[0]!.tickets_total).toBe(1);
    expect(r.projets[0]!.tickets_ouverts).toBe(1);
  });

  it("refuse un projet introuvable", () => {
    contexte = creerDbTemp();
    const r = etatProjet(contexte.db, { projet: "N'existe pas" });
    expect(r.ok).toBe(false);
  });

  it("le détail groupe les tickets par epic", () => {
    contexte = creerDbTemp();
    creerTicket(contexte.db, { projet: "P", epic: "Discovery", titre: "Analyse", type: "analyse" });
    creerTicket(contexte.db, { projet: "P", epic: "Build", titre: "Dev export", type: "task" });

    const r = etatProjet(contexte.db, { projet: "P" });
    expect(r.ok).toBe(true);
    if (!r.ok || !("epics" in r)) return;
    expect(r.epics.map((e) => e.nom)).toEqual(["Discovery", "Build"]);
    expect(r.epics[0]!.tickets[0]!.titre).toBe("Analyse");
    expect(r.epics[1]!.tickets[0]!.titre).toBe("Dev export");
  });
});
