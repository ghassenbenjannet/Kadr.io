#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ouvrirDb } from "../db/client.js";
import { migrer } from "../db/migrate.js";
import { chargerConfig } from "../agent/config.js";
import { chargerPromptSysteme } from "../agent/prompt.js";
import { creerApp } from "./app.js";

const iciDir = dirname(fileURLToPath(import.meta.url)); // dist/server
const racineDepot = join(iciDir, "..", ".."); // repo root (le build tourne dans dist/)
const dossierFront = join(racineDepot, "front");
const dossierPublic = join(iciDir, "..", "public"); // dist/public

/** Un seul `npm start` : construit le front s'il manque encore. */
function assurerFrontBuild(): void {
  const indexHtml = join(dossierPublic, "index.html");
  if (existsSync(indexHtml)) return;
  if (!existsSync(dossierFront)) {
    console.warn("front/ introuvable : l'interface web ne sera pas servie (API seule disponible).");
    return;
  }
  console.log("Build du front absent : construction en cours…");
  execSync("npm install && npm run build", { cwd: dossierFront, stdio: "inherit" });
}

const PORT = Number(process.env.PORT ?? 3737);

function main(): void {
  const db = ouvrirDb();
  migrer(db);
  const config = chargerConfig();
  if (!config.apiKey) {
    console.warn(
      "Aucune clé API Anthropic configurée : les vues de lecture fonctionnent, la conversation sera indisponible " +
        "tant que ~/.registre-si/config.json (anthropicApiKey) ou ANTHROPIC_API_KEY ne sont pas renseignés."
    );
  }
  const promptSysteme = chargerPromptSysteme();

  assurerFrontBuild();

  const app = creerApp({ db, config, promptSysteme });

  if (existsSync(join(dossierPublic, "index.html"))) {
    const racineRelative = relative(process.cwd(), dossierPublic) || ".";
    app.use("/assets/*", serveStatic({ root: racineRelative }));
    app.get("*", (c) => {
      if (c.req.path.startsWith("/api/")) return c.notFound();
      return c.html(readFileSync(join(dossierPublic, "index.html"), "utf-8"));
    });
  }

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Registre SI — http://localhost:${info.port}`);
  });
}

main();
