import { z } from "zod";

export const equipeEnum = z.enum([
  "CS",
  "AE",
  "Marketing",
  "ADV",
  "Produit",
  "Communication",
  "Direction",
  "Autre",
]);

export const typeDemandeEnum = z.enum(["evolution", "correction", "question", "acces", "incident"]);

export const prioriteEnum = z.enum(["P1", "P2", "P3"]);

export const statutDemandeEnum = z.enum([
  "recue",
  "qualifiee",
  "arbitree",
  "realisee",
  "refusee",
  "reportee",
]);

export const statutDecisionEnum = z.enum(["proposee", "validee", "appliquee", "remplacee"]);

export const typeChangementEnum = z.enum([
  "parametrage",
  "deluge",
  "sql",
  "javascript",
  "config_api",
  "habilitations",
  "autre",
]);
