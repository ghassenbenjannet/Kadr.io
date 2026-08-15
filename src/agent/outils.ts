// Adaptateur : catalogue des outils exposés à l'agent, avec leur nature
// (lecture = exécution immédiate, écriture = validation requise) et la
// conversion de leur schéma zod en input_schema JSON Schema pour l'API
// Anthropic (§5.3 spec Jalon 1 bis).

import { z } from "zod";
import type Database from "better-sqlite3";
import { zodToJsonSchema } from "zod-to-json-schema";

import * as outilDemande from "../tools/enregistrer-demande.js";
import { enregistrerDemande } from "../tools/enregistrer-demande.js";
import * as outilMettreAJourDemande from "../tools/mettre-a-jour-demande.js";
import { mettreAJourDemande } from "../tools/mettre-a-jour-demande.js";
import * as outilDecision from "../tools/enregistrer-decision.js";
import { enregistrerDecision } from "../tools/enregistrer-decision.js";
import * as outilChangement from "../tools/enregistrer-changement.js";
import { enregistrerChangement } from "../tools/enregistrer-changement.js";
import * as outilIncident from "../tools/enregistrer-incident.js";
import { enregistrerIncident } from "../tools/enregistrer-incident.js";
import * as outilRecherche from "../tools/rechercher-journal.js";
import { rechercherJournal } from "../tools/rechercher-journal.js";
import * as outilLancerControles from "../tools/lancer-controles.js";
import { lancerControles } from "../tools/lancer-controles.js";
import * as outilConstatsOuverts from "../tools/constats-ouverts.js";
import { constatsOuverts } from "../tools/constats-ouverts.js";
import * as outilRapport from "../tools/generer-rapport.js";
import { genererRapport } from "../tools/generer-rapport.js";
import * as outilDecrireSysteme from "../tools/decrire-systeme.js";
import { decrireSysteme } from "../tools/decrire-systeme.js";
import * as outilDecrireModule from "../tools/decrire-module.js";
import { decrireModule } from "../tools/decrire-module.js";
import * as outilDecrireChamp from "../tools/decrire-champ.js";
import { decrireChamp } from "../tools/decrire-champ.js";
import * as outilDecrireHabilitation from "../tools/decrire-habilitation.js";
import { decrireHabilitation } from "../tools/decrire-habilitation.js";
import * as outilDecrireIntegration from "../tools/decrire-integration.js";
import { decrireIntegration } from "../tools/decrire-integration.js";
import * as outilDecrireAutomatisation from "../tools/decrire-automatisation.js";
import { decrireAutomatisation } from "../tools/decrire-automatisation.js";
import * as outilImpact from "../tools/impact.js";
import { impact } from "../tools/impact.js";
import * as outilLierChangement from "../tools/lier-changement.js";
import { lierChangement } from "../tools/lier-changement.js";
import * as outilZohoConfigurer from "../tools/zoho-configurer.js";
import { zohoConfigurer } from "../tools/zoho-configurer.js";

export type NatureOutil = "lecture" | "ecriture";

export interface DefinitionOutil {
  nom: string;
  description: string;
  nature: NatureOutil;
  schemaEntree: z.ZodRawShape;
  /** Exécute l'outil. db est ignoré par les outils qui n'en ont pas besoin (ex: zoho_configurer). */
  executer: (db: Database.Database, params: unknown) => unknown | Promise<unknown>;
}

// lancer_controles est classé en lecture bien qu'il écrive dans `constats` :
// c'est un calcul déterministe et idempotent (upsert de constats), sans
// effet sur le journal ni sur la carte — voir §5.3 de la spec.
const DEFINITIONS: DefinitionOutil[] = [
  {
    nom: outilRecherche.nom,
    description: outilRecherche.description,
    nature: "lecture",
    schemaEntree: outilRecherche.schemaEntree,
    executer: (db, p) => rechercherJournal(db, p as never),
  },
  {
    nom: outilConstatsOuverts.nom,
    description: outilConstatsOuverts.description,
    nature: "lecture",
    schemaEntree: outilConstatsOuverts.schemaEntree,
    executer: (db, p) => constatsOuverts(db, p as never),
  },
  {
    nom: outilLancerControles.nom,
    description: outilLancerControles.description,
    nature: "lecture",
    schemaEntree: outilLancerControles.schemaEntree,
    executer: (db, p) => lancerControles(db, p as never),
  },
  {
    nom: outilRapport.nom,
    description: outilRapport.description,
    nature: "lecture",
    schemaEntree: outilRapport.schemaEntree,
    executer: (db, p) => genererRapport(db, p as never),
  },
  {
    nom: outilImpact.nom,
    description: outilImpact.description,
    nature: "lecture",
    schemaEntree: outilImpact.schemaEntree,
    executer: (db, p) => impact(db, p as never),
  },
  {
    nom: outilDemande.nom,
    description: outilDemande.description,
    nature: "ecriture",
    schemaEntree: outilDemande.schemaEntree,
    executer: (db, p) => enregistrerDemande(db, p as never),
  },
  {
    nom: outilMettreAJourDemande.nom,
    description: outilMettreAJourDemande.description,
    nature: "ecriture",
    schemaEntree: outilMettreAJourDemande.schemaEntree,
    executer: (db, p) => mettreAJourDemande(db, p as never),
  },
  {
    nom: outilDecision.nom,
    description: outilDecision.description,
    nature: "ecriture",
    schemaEntree: outilDecision.schemaEntree,
    executer: (db, p) => enregistrerDecision(db, p as never),
  },
  {
    nom: outilChangement.nom,
    description: outilChangement.description,
    nature: "ecriture",
    schemaEntree: outilChangement.schemaEntree,
    executer: (db, p) => enregistrerChangement(db, p as never),
  },
  {
    nom: outilIncident.nom,
    description: outilIncident.description,
    nature: "ecriture",
    schemaEntree: outilIncident.schemaEntree,
    executer: (db, p) => enregistrerIncident(db, p as never),
  },
  {
    nom: outilDecrireSysteme.nom,
    description: outilDecrireSysteme.description,
    nature: "ecriture",
    schemaEntree: outilDecrireSysteme.schemaEntree,
    executer: (db, p) => decrireSysteme(db, p as never),
  },
  {
    nom: outilDecrireModule.nom,
    description: outilDecrireModule.description,
    nature: "ecriture",
    schemaEntree: outilDecrireModule.schemaEntree,
    executer: (db, p) => decrireModule(db, p as never),
  },
  {
    nom: outilDecrireChamp.nom,
    description: outilDecrireChamp.description,
    nature: "ecriture",
    schemaEntree: outilDecrireChamp.schemaEntree,
    executer: (db, p) => decrireChamp(db, p as never),
  },
  {
    nom: outilDecrireHabilitation.nom,
    description: outilDecrireHabilitation.description,
    nature: "ecriture",
    schemaEntree: outilDecrireHabilitation.schemaEntree,
    executer: (db, p) => decrireHabilitation(db, p as never),
  },
  {
    nom: outilDecrireIntegration.nom,
    description: outilDecrireIntegration.description,
    nature: "ecriture",
    schemaEntree: outilDecrireIntegration.schemaEntree,
    executer: (db, p) => decrireIntegration(db, p as never),
  },
  {
    nom: outilDecrireAutomatisation.nom,
    description: outilDecrireAutomatisation.description,
    nature: "ecriture",
    schemaEntree: outilDecrireAutomatisation.schemaEntree,
    executer: (db, p) => decrireAutomatisation(db, p as never),
  },
  {
    nom: outilLierChangement.nom,
    description: outilLierChangement.description,
    nature: "ecriture",
    schemaEntree: outilLierChangement.schemaEntree,
    executer: (db, p) => lierChangement(db, p as never),
  },
  {
    nom: outilZohoConfigurer.nom,
    description: outilZohoConfigurer.description,
    nature: "ecriture",
    schemaEntree: outilZohoConfigurer.schemaEntree,
    executer: (_db, p) => zohoConfigurer(p as never),
  },
];

export function catalogueOutils(): DefinitionOutil[] {
  return DEFINITIONS;
}

export function outilParNom(nom: string): DefinitionOutil | undefined {
  return DEFINITIONS.find((d) => d.nom === nom);
}

export interface OutilAnthropic {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Convertit tout le catalogue en tools[] au format de l'API Anthropic. */
export function schemasAnthropic(): OutilAnthropic[] {
  return DEFINITIONS.map((d) => ({
    name: d.nom,
    description: d.description,
    input_schema: zodToJsonSchema(z.object(d.schemaEntree)) as Record<string, unknown>,
  }));
}
