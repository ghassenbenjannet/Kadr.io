// Construction de l'application Hono (§6 spec Jalon 1 bis). Séparée du
// démarrage réseau (index.ts) pour rester testable via app.request(), sans
// jamais ouvrir de socket ni appeler l'API Anthropic réellement.

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type Database from "better-sqlite3";
import type { ConfigAgent } from "../agent/config.js";
import type { ClientAnthropic } from "../agent/client.js";
import { clientAnthropicReel } from "../agent/client.js";
import { envoyerMessageUtilisateur, reprendreApresDecision } from "../agent/boucle.js";
import { listerMessages } from "../agent/messages.js";
import { resumerResultatLecture } from "../agent/resume-resultat.js";
import { trouverEcriture } from "../agent/ecritures.js";
import { listerJournal } from "./journal.js";
import { listerDemandes } from "./demandes.js";
import { z } from "zod";
import { listerProjets, detailProjet, detailTicket } from "./projets.js";
import { detailDocument } from "./documents.js";
import { detailEntiteComplet } from "./entites.js";
import { creerDocument } from "../tools/creer-document.js";
import { schemaEntree as schemaCreerDocument } from "../tools/creer-document.js";
import { mettreAJourDocument } from "../tools/mettre-a-jour-document.js";
import { schemaEntree as schemaMettreAJourDocument } from "../tools/mettre-a-jour-document.js";
import { constatsOuverts } from "../tools/constats-ouverts.js";
import { genererRapport } from "../tools/generer-rapport.js";
import {
  matriceHabilitations,
  modulesDistincts,
  champsParSourceDeVerite,
  integrationsAvecConstats,
} from "../web/donnees.js";

export interface DependancesApp {
  db: Database.Database;
  config: ConfigAgent;
  promptSysteme: string;
  /** Injectable pour les tests : par défaut, le vrai client Anthropic en streaming. */
  creerClient?: (apiKey: string) => ClientAnthropic;
}

export function creerApp(deps: DependancesApp): Hono {
  const { db, config, promptSysteme } = deps;
  const creerClient = deps.creerClient ?? clientAnthropicReel;
  const app = new Hono();

  // --- Lecture ---------------------------------------------------------

  app.get("/api/journal", (c) => {
    const entite = c.req.query("entite");
    const depuis = c.req.query("depuis");
    const jusquA = c.req.query("jusqu_a");
    const lignes = listerJournal(db, { entite, depuis, jusquA });
    return c.json({ ok: true, journal: lignes });
  });

  app.get("/api/constats", (c) => {
    return c.json(constatsOuverts(db, {}));
  });

  app.get("/api/rapport/hebdo", (c) => {
    const semaine = c.req.query("semaine");
    const resultat = genererRapport(db, { type: "hebdo", semaine });
    if (!resultat.ok) return c.json(resultat, 400);
    return c.body(resultat.markdown ?? "", 200, { "Content-Type": "text/markdown; charset=utf-8" });
  });

  app.get("/api/habilitations", (c) => {
    const moduleFiltre = c.req.query("module") || undefined;
    const { champs, profils, cellules } = matriceHabilitations(db, moduleFiltre);
    const modules = modulesDistincts(db);
    return c.json({ ok: true, champs, profils, modules, cellules: Object.fromEntries(cellules) });
  });

  app.get("/api/champs", (c) => {
    return c.json({ ok: true, groupes: champsParSourceDeVerite(db) });
  });

  app.get("/api/integrations", (c) => {
    return c.json({ ok: true, integrations: integrationsAvecConstats(db) });
  });

  app.get("/api/demandes", (c) => {
    return c.json({ ok: true, demandes: listerDemandes(db) });
  });

  app.get("/api/journal/:entite/:id", (c) => {
    const detail = detailEntiteComplet(db, c.req.param("entite"), c.req.param("id"));
    if (!detail) return c.json({ ok: false, erreur: "Entrée introuvable." }, 404);
    return c.json({ ok: true, entite: c.req.param("entite"), ...detail });
  });

  app.get("/api/tickets/:id", (c) => {
    const detail = detailTicket(db, c.req.param("id"));
    if (!detail) return c.json({ ok: false, erreur: "Ticket introuvable." }, 404);
    return c.json({ ok: true, ...detail });
  });

  app.get("/api/documents/:id", (c) => {
    const detail = detailDocument(db, c.req.param("id"));
    if (!detail) return c.json({ ok: false, erreur: "Page introuvable." }, 404);
    return c.json({ ok: true, ...detail });
  });

  // Écriture directe, SANS carte de validation : ces deux routes servent
  // l'éditeur en page, où c'est Ghassen qui tape le texte lui-même — la
  // validation existe pour rattraper l'agent quand il interprète mal ce
  // qu'on lui dit, pas pour la prose qu'on écrit soi-même. L'agent garde
  // ses propres outils (creer_document / mettre_a_jour_document), eux
  // toujours validés comme le reste.
  app.post("/api/documents", async (c) => {
    const corps = await c.req.json().catch(() => ({}));
    const analyse = z.object(schemaCreerDocument).safeParse(corps);
    if (!analyse.success) {
      return c.json({ ok: false, erreur: analyse.error.issues[0]?.message ?? "Corps invalide." }, 400);
    }
    const resultat = creerDocument(db, analyse.data);
    return c.json(resultat, resultat.ok ? 200 : 400);
  });

  app.put("/api/documents/:id", async (c) => {
    const corps = await c.req.json().catch(() => ({}));
    const analyse = z.object(schemaMettreAJourDocument).safeParse({ ...corps, id: c.req.param("id") });
    if (!analyse.success) {
      return c.json({ ok: false, erreur: analyse.error.issues[0]?.message ?? "Corps invalide." }, 400);
    }
    const resultat = mettreAJourDocument(db, analyse.data);
    return c.json(resultat, resultat.ok ? 200 : 400);
  });

  app.get("/api/projets", (c) => {
    return c.json({ ok: true, projets: listerProjets(db) });
  });

  app.get("/api/projets/:id", (c) => {
    const detail = detailProjet(db, c.req.param("id"));
    if (!detail) return c.json({ ok: false, erreur: "Projet introuvable." }, 404);
    return c.json({ ok: true, ...detail });
  });

  app.get("/api/conversations", (c) => {
    const rows = db
      .prepare("SELECT id, titre, cree_le, maj_le FROM conversations ORDER BY maj_le DESC")
      .all();
    return c.json({ ok: true, conversations: rows });
  });

  app.get("/api/conversations/:id", (c) => {
    const id = c.req.param("id");
    const conversation = db.prepare("SELECT id, titre, cree_le, maj_le FROM conversations WHERE id = ?").get(id);
    if (!conversation) return c.json({ ok: false, erreur: "Conversation introuvable." }, 404);
    const messages = listerMessages(db, id);
    return c.json({ ok: true, conversation, messages });
  });

  // --- Agent -------------------------------------------------------------

  app.post("/api/chat", async (c) => {
    if (!config.apiKey) {
      return c.json(
        {
          ok: false,
          erreur:
            "Clé API Anthropic non configurée. Ajoute-la dans ~/.registre-si/config.json (anthropicApiKey) " +
            "ou via la variable d'environnement ANTHROPIC_API_KEY, puis redémarre.",
        },
        503
      );
    }

    const corps = await c.req.json<{ conversationId?: string; message?: string }>();
    if (!corps.message || corps.message.trim().length === 0) {
      return c.json({ ok: false, erreur: "message est requis." }, 400);
    }

    const client = creerClient(config.apiKey);

    return streamSSE(c, async (stream) => {
      try {
        const resultat = await envoyerMessageUtilisateur(
          db,
          client,
          config,
          promptSysteme,
          { conversationId: corps.conversationId, message: corps.message! },
          {
            onTexte: async (delta) => {
              await stream.writeSSE({ event: "texte", data: delta });
            },
            onOutilLecture: async (nomOutil) => {
              await stream.writeSSE({ event: "outil_lecture", data: JSON.stringify({ outil: nomOutil, phase: "debut" }) });
            },
            onOutilLectureTermine: async (nomOutil, resultat) => {
              await stream.writeSSE({
                event: "outil_lecture",
                data: JSON.stringify({ outil: nomOutil, phase: "fin", resume: resumerResultatLecture(resultat) }),
              });
            },
            onValidationRequise: async (ecriture) => {
              await stream.writeSSE({ event: "validation_requise", data: JSON.stringify(ecriture) });
            },
          }
        );
        await stream.writeSSE({ event: "fin", data: JSON.stringify(resultat) });
      } catch (erreur) {
        await stream.writeSSE({
          event: "erreur",
          data: JSON.stringify({ erreur: erreur instanceof Error ? erreur.message : String(erreur) }),
        });
      }
    });
  });

  app.post("/api/confirm", async (c) => {
    if (!config.apiKey) {
      return c.json(
        { ok: false, erreur: "Clé API Anthropic non configurée. Impossible de reprendre la conversation." },
        503
      );
    }

    const corps = await c.req.json<{ ecritureId?: string; action?: "valider" | "rejeter"; parametres?: unknown }>();
    if (!corps.ecritureId || !corps.action) {
      return c.json({ ok: false, erreur: "ecritureId et action sont requis." }, 400);
    }

    const client = creerClient(config.apiKey);

    try {
      const resultat = await reprendreApresDecision(db, client, config, promptSysteme, {
        ecritureId: corps.ecritureId,
        decision: corps.action,
        parametres: corps.parametres,
      });

      let texteAssistant: string | undefined;
      if (resultat.termine) {
        const messages = listerMessages(db, resultat.conversationId);
        const dernier = [...messages].reverse().find((m) => m.role === "assistant");
        texteAssistant = dernier?.contenu
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("\n");
      }

      // Si la reprise enchaîne directement sur une nouvelle écriture proposée
      // (rare mais possible), on renvoie son détail complet : le front n'a
      // pas d'autre moyen de l'obtenir que le flux SSE de /api/chat.
      const ecriture =
        resultat.enAttenteValidation && resultat.ecritureId ? trouverEcriture(db, resultat.ecritureId) : undefined;

      return c.json({ ok: true, ...resultat, texteAssistant, ecriture });
    } catch (erreur) {
      return c.json({ ok: false, erreur: erreur instanceof Error ? erreur.message : String(erreur) }, 400);
    }
  });

  return app;
}
