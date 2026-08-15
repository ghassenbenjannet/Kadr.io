#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ouvrirDb } from "./db/client.js";
import { migrer } from "./db/migrate.js";

import * as outilDemande from "./tools/enregistrer-demande.js";
import { enregistrerDemande } from "./tools/enregistrer-demande.js";
import * as outilDecision from "./tools/enregistrer-decision.js";
import { enregistrerDecision } from "./tools/enregistrer-decision.js";
import * as outilChangement from "./tools/enregistrer-changement.js";
import { enregistrerChangement } from "./tools/enregistrer-changement.js";
import * as outilIncident from "./tools/enregistrer-incident.js";
import { enregistrerIncident } from "./tools/enregistrer-incident.js";
import * as outilRecherche from "./tools/rechercher-journal.js";
import { rechercherJournal } from "./tools/rechercher-journal.js";
import * as outilLancerControles from "./tools/lancer-controles.js";
import { lancerControles } from "./tools/lancer-controles.js";
import * as outilConstatsOuverts from "./tools/constats-ouverts.js";
import { constatsOuverts } from "./tools/constats-ouverts.js";
import * as outilRapport from "./tools/generer-rapport.js";
import { genererRapport } from "./tools/generer-rapport.js";

const db = ouvrirDb();
migrer(db);

const server = new McpServer({ name: "registre-si", version: "1.0.0" });

function texte(resultat: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(resultat, null, 2) }] };
}

server.registerTool(
  outilDemande.nom,
  { description: outilDemande.description, inputSchema: outilDemande.schemaEntree },
  async (args) => texte(enregistrerDemande(db, args))
);

server.registerTool(
  outilDecision.nom,
  { description: outilDecision.description, inputSchema: outilDecision.schemaEntree },
  async (args) => texte(enregistrerDecision(db, args))
);

server.registerTool(
  outilChangement.nom,
  { description: outilChangement.description, inputSchema: outilChangement.schemaEntree },
  async (args) => texte(enregistrerChangement(db, args))
);

server.registerTool(
  outilIncident.nom,
  { description: outilIncident.description, inputSchema: outilIncident.schemaEntree },
  async (args) => texte(enregistrerIncident(db, args))
);

server.registerTool(
  outilRecherche.nom,
  { description: outilRecherche.description, inputSchema: outilRecherche.schemaEntree },
  async (args) => texte(rechercherJournal(db, args))
);

server.registerTool(
  outilLancerControles.nom,
  { description: outilLancerControles.description, inputSchema: outilLancerControles.schemaEntree },
  async (args) => texte(lancerControles(db, args))
);

server.registerTool(
  outilConstatsOuverts.nom,
  { description: outilConstatsOuverts.description, inputSchema: outilConstatsOuverts.schemaEntree },
  async (args) => texte(constatsOuverts(db, args))
);

server.registerTool(
  outilRapport.nom,
  { description: outilRapport.description, inputSchema: outilRapport.schemaEntree },
  async (args) => texte(genererRapport(db, args))
);

const transport = new StdioServerTransport();
await server.connect(transport);
