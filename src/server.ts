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
import * as outilDecrireSysteme from "./tools/decrire-systeme.js";
import { decrireSysteme } from "./tools/decrire-systeme.js";
import * as outilDecrireModule from "./tools/decrire-module.js";
import { decrireModule } from "./tools/decrire-module.js";
import * as outilDecrireChamp from "./tools/decrire-champ.js";
import { decrireChamp } from "./tools/decrire-champ.js";
import * as outilDecrireHabilitation from "./tools/decrire-habilitation.js";
import { decrireHabilitation } from "./tools/decrire-habilitation.js";
import * as outilDecrireIntegration from "./tools/decrire-integration.js";
import { decrireIntegration } from "./tools/decrire-integration.js";
import * as outilDecrireAutomatisation from "./tools/decrire-automatisation.js";
import { decrireAutomatisation } from "./tools/decrire-automatisation.js";
import * as outilImpact from "./tools/impact.js";
import { impact } from "./tools/impact.js";
import * as outilLierChangement from "./tools/lier-changement.js";
import { lierChangement } from "./tools/lier-changement.js";
import * as outilZohoConfigurer from "./tools/zoho-configurer.js";
import { zohoConfigurer } from "./tools/zoho-configurer.js";

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

server.registerTool(
  outilDecrireSysteme.nom,
  { description: outilDecrireSysteme.description, inputSchema: outilDecrireSysteme.schemaEntree },
  async (args) => texte(decrireSysteme(db, args))
);

server.registerTool(
  outilDecrireModule.nom,
  { description: outilDecrireModule.description, inputSchema: outilDecrireModule.schemaEntree },
  async (args) => texte(decrireModule(db, args))
);

server.registerTool(
  outilDecrireChamp.nom,
  { description: outilDecrireChamp.description, inputSchema: outilDecrireChamp.schemaEntree },
  async (args) => texte(decrireChamp(db, args))
);

server.registerTool(
  outilDecrireHabilitation.nom,
  { description: outilDecrireHabilitation.description, inputSchema: outilDecrireHabilitation.schemaEntree },
  async (args) => texte(decrireHabilitation(db, args))
);

server.registerTool(
  outilDecrireIntegration.nom,
  { description: outilDecrireIntegration.description, inputSchema: outilDecrireIntegration.schemaEntree },
  async (args) => texte(decrireIntegration(db, args))
);

server.registerTool(
  outilDecrireAutomatisation.nom,
  {
    description: outilDecrireAutomatisation.description,
    inputSchema: outilDecrireAutomatisation.schemaEntree,
  },
  async (args) => texte(decrireAutomatisation(db, args))
);

server.registerTool(
  outilImpact.nom,
  { description: outilImpact.description, inputSchema: outilImpact.schemaEntree },
  async (args) => texte(impact(db, args))
);

server.registerTool(
  outilLierChangement.nom,
  { description: outilLierChangement.description, inputSchema: outilLierChangement.schemaEntree },
  async (args) => texte(lierChangement(db, args))
);

server.registerTool(
  outilZohoConfigurer.nom,
  { description: outilZohoConfigurer.description, inputSchema: outilZohoConfigurer.schemaEntree },
  async (args) => texte(await zohoConfigurer(args))
);

const transport = new StdioServerTransport();
await server.connect(transport);
