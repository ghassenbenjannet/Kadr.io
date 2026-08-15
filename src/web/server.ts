#!/usr/bin/env node
import { createServer } from "node:http";
import { URL } from "node:url";
import { ouvrirDb } from "../db/client.js";
import { migrer } from "../db/migrate.js";
import { rendrePageHabilitations } from "./pages/habilitations.js";
import { rendrePageChamps } from "./pages/champs.js";
import { rendrePageIntegrations } from "./pages/integrations.js";
import { rendrePageConstats } from "./pages/constats.js";

const db = ouvrirDb();
migrer(db);

const PORT = Number(process.env.WEB_PORT ?? 3737);

const serveur = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (url.pathname === "/") {
    const moduleFiltre = url.searchParams.get("module") ?? undefined;
    res.end(rendrePageHabilitations(db, moduleFiltre));
    return;
  }
  if (url.pathname === "/champs") {
    res.end(rendrePageChamps(db));
    return;
  }
  if (url.pathname === "/integrations") {
    res.end(rendrePageIntegrations(db));
    return;
  }
  if (url.pathname === "/constats") {
    res.end(rendrePageConstats(db));
    return;
  }

  res.statusCode = 404;
  res.end("<!doctype html><html><body><p>Page introuvable.</p></body></html>");
});

serveur.listen(PORT, () => {
  console.log(`Registre SI — interface web sur http://localhost:${PORT}`);
});
