import { afterEach, describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import {
  creerServeurMcp,
  nomsOutilsExposesMcp,
  outilsDuCatalogueExposesMcp,
  NOMS_OUTILS_TRANSPORT,
} from "../src/mcp/server.js";
import { catalogueOutils } from "../src/agent/outils.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

async function demarrerClientEtServeur(db: DbTemp["db"]) {
  const server = creerServeurMcp(db);
  const [transportServeur, transportClient] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(transportServeur), client.connect(transportClient)]);
  return { server, client };
}

function texteDe(resultat: { content: { type: string; text?: string }[] }): string {
  return resultat.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}

describe("liste des outils MCP exposés", () => {
  it("= catalogue moins charger_mode, plus les 3 outils de transport ; supprimer_entite n'y figure jamais", () => {
    const noms = nomsOutilsExposesMcp();
    const attendu = [
      ...catalogueOutils()
        .filter((d) => d.nom !== "charger_mode")
        .map((d) => d.nom),
      ...NOMS_OUTILS_TRANSPORT,
    ];
    expect(noms.sort()).toEqual(attendu.sort());
    expect(noms).not.toContain("charger_mode");
    expect(noms).not.toContain("supprimer_entite");
    expect(outilsDuCatalogueExposesMcp().length).toBe(catalogueOutils().length - 1);
  });

  it("le serveur MCP réellement instancié annonce exactement cette liste (protocole ListTools)", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(nomsOutilsExposesMcp().sort());
  });
});

describe("§7.2 lecture via MCP", () => {
  it("rechercher_journal exécute et répond, sans créer d'écriture proposée", async () => {
    contexte = creerDbTemp();
    const maintenant = new Date().toISOString();
    contexte.db
      .prepare(
        `INSERT INTO demandes (id, cree_le, demandeur, equipe, expression_brute, type, statut, maj_le)
         VALUES ('d1', ?, 'Sophie', 'CS', 'voir les factures dans la fiche client', 'evolution', 'recue', ?)`
      )
      .run(maintenant, maintenant);

    const { client } = await demarrerClientEtServeur(contexte.db);
    const resultat = await client.callTool({ name: "rechercher_journal", arguments: { question: "factures" } });

    expect(resultat.isError).toBeFalsy();
    expect(texteDe(resultat as never)).toContain("factures");

    const nbEcritures = contexte.db.prepare("SELECT COUNT(*) AS n FROM ecritures_proposees").get() as { n: number };
    expect(nbEcritures.n).toBe(0);
  });
});

describe("§7.3 écriture via MCP", () => {
  it("enregistrer_changement sans rollback : aucune ligne dans changements, une ecriture_proposee origine mcp, avertissement rollback dans la réponse", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);

    const resultat = await client.callTool({
      name: "enregistrer_changement",
      arguments: { description: "Ajout d'un champ", perimetre: "Module facturation", type: "parametrage" },
    });

    expect(resultat.isError).toBeFalsy();
    const texte = texteDe(resultat as never);
    expect(texte).toContain("Écriture proposée");
    expect(texte).toContain("Aucun retour arrière déclaré");

    const nbChangements = contexte.db.prepare("SELECT COUNT(*) AS n FROM changements").get() as { n: number };
    expect(nbChangements.n).toBe(0);

    const ecriture = contexte.db
      .prepare("SELECT origine, statut, outil FROM ecritures_proposees")
      .get() as { origine: string; statut: string; outil: string };
    expect(ecriture.origine).toBe("mcp");
    expect(ecriture.statut).toBe("en_attente");
    expect(ecriture.outil).toBe("enregistrer_changement");
  });
});

describe("§7.4 confirmer_ecriture", () => {
  async function proposerDemande(client: Client) {
    return client.callTool({
      name: "enregistrer_demande",
      arguments: { demandeur: "Sophie", equipe: "CS", expression_brute: "voir les factures", type: "evolution" },
    });
  }

  function idPropose(db: DbTemp["db"]): string {
    const row = db.prepare("SELECT id FROM ecritures_proposees ORDER BY rowid DESC LIMIT 1").get() as { id: string };
    return row.id;
  }

  it("exécute, ligne créée, statut validee", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);
    await proposerDemande(client);
    const ecritureId = idPropose(contexte.db);

    const resultat = await client.callTool({ name: "confirmer_ecriture", arguments: { ecriture_id: ecritureId } });
    expect(resultat.isError).toBeFalsy();

    const ecriture = contexte.db.prepare("SELECT statut FROM ecritures_proposees WHERE id = ?").get(ecritureId) as {
      statut: string;
    };
    expect(ecriture.statut).toBe("validee");
    const demandes = contexte.db.prepare("SELECT demandeur FROM demandes").get() as { demandeur: string };
    expect(demandes.demandeur).toBe("Sophie");
  });

  it("avec parametres corrigés : modifiee_validee et les valeurs corrigées en base", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);
    await proposerDemande(client);
    const ecritureId = idPropose(contexte.db);

    await client.callTool({
      name: "confirmer_ecriture",
      arguments: {
        ecriture_id: ecritureId,
        parametres: { demandeur: "Sophie", equipe: "ADV", expression_brute: "voir les factures", type: "evolution" },
      },
    });

    const ecriture = contexte.db.prepare("SELECT statut FROM ecritures_proposees WHERE id = ?").get(ecritureId) as {
      statut: string;
    };
    expect(ecriture.statut).toBe("modifiee_validee");
    const demande = contexte.db.prepare("SELECT equipe FROM demandes").get() as { equipe: string };
    expect(demande.equipe).toBe("ADV");
  });

  it("deuxième confirmation : ok:false « déjà tranchée »", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);
    await proposerDemande(client);
    const ecritureId = idPropose(contexte.db);

    await client.callTool({ name: "confirmer_ecriture", arguments: { ecriture_id: ecritureId } });
    const resultat = await client.callTool({ name: "confirmer_ecriture", arguments: { ecriture_id: ecritureId } });

    expect(resultat.isError).toBe(true);
    expect(texteDe(resultat as never)).toContain("déjà tranchée");
  });

  it("paramètres invalides (zod) : ok:false, écriture toujours en_attente", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);
    await proposerDemande(client);
    const ecritureId = idPropose(contexte.db);

    const resultat = await client.callTool({
      name: "confirmer_ecriture",
      arguments: { ecriture_id: ecritureId, parametres: { demandeur: "Sophie" } },
    });

    expect(resultat.isError).toBe(true);
    const ecriture = contexte.db.prepare("SELECT statut FROM ecritures_proposees WHERE id = ?").get(ecritureId) as {
      statut: string;
    };
    expect(ecriture.statut).toBe("en_attente");
    const demandes = contexte.db.prepare("SELECT COUNT(*) AS n FROM demandes").get() as { n: number };
    expect(demandes.n).toBe(0);
  });

  it("écriture introuvable : ok:false", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);
    const resultat = await client.callTool({ name: "confirmer_ecriture", arguments: { ecriture_id: "inconnue" } });
    expect(resultat.isError).toBe(true);
    expect(texteDe(resultat as never)).toContain("introuvable");
  });
});

describe("§7.5 rejeter_ecriture", () => {
  it("statut rejetee, aucune ligne métier créée", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);
    await client.callTool({
      name: "enregistrer_demande",
      arguments: { demandeur: "Sophie", equipe: "CS", expression_brute: "voir les factures", type: "evolution" },
    });
    const ecritureId = (
      contexte.db.prepare("SELECT id FROM ecritures_proposees ORDER BY rowid DESC LIMIT 1").get() as { id: string }
    ).id;

    const resultat = await client.callTool({
      name: "rejeter_ecriture",
      arguments: { ecriture_id: ecritureId, raison: "Doublon" },
    });
    expect(resultat.isError).toBeFalsy();

    const ecriture = contexte.db.prepare("SELECT statut, resultat FROM ecritures_proposees WHERE id = ?").get(
      ecritureId
    ) as { statut: string; resultat: string };
    expect(ecriture.statut).toBe("rejetee");
    expect(ecriture.resultat).toContain("Doublon");

    const demandes = contexte.db.prepare("SELECT COUNT(*) AS n FROM demandes").get() as { n: number };
    expect(demandes.n).toBe(0);
  });
});

describe("§7.6 écriture MCP tranchée sans conversation", () => {
  it("aucune ligne dans messages après confirmer_ecriture", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);
    await client.callTool({
      name: "enregistrer_demande",
      arguments: { demandeur: "Sophie", equipe: "CS", expression_brute: "voir les factures", type: "evolution" },
    });
    const ecritureId = (
      contexte.db.prepare("SELECT id FROM ecritures_proposees ORDER BY rowid DESC LIMIT 1").get() as { id: string }
    ).id;

    await client.callTool({ name: "confirmer_ecriture", arguments: { ecriture_id: ecritureId } });

    const nbMessages = contexte.db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number };
    expect(nbMessages.n).toBe(0);
  });
});

describe("ecritures_en_attente", () => {
  it("liste les écritures en attente avec leurs avertissements, vide si aucune", async () => {
    contexte = creerDbTemp();
    const { client } = await demarrerClientEtServeur(contexte.db);

    const vide = await client.callTool({ name: "ecritures_en_attente", arguments: {} });
    expect(texteDe(vide as never)).toContain("Aucune écriture en attente");

    await client.callTool({
      name: "enregistrer_changement",
      arguments: { description: "x", perimetre: "y", type: "parametrage" },
    });
    const resultat = await client.callTool({ name: "ecritures_en_attente", arguments: {} });
    const texte = texteDe(resultat as never);
    expect(texte).toContain("enregistrer_changement");
    expect(texte).toContain("Aucun retour arrière déclaré");
  });
});
