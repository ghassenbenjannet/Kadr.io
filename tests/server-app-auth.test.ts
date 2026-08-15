import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";
import { reinitialiser } from "../src/auth/limiteur.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const PROMPT = "Tu es l'assistant du Registre SI.";

function extraireCookie(res: Response): string {
  const brut = res.headers.get("set-cookie") ?? "";
  return brut.split(";")[0] ?? "";
}

describe("sans REGISTRE_PASSWORD configuré", () => {
  it("aucune route n'est verrouillée, /api/session le confirme", async () => {
    contexte = creerDbTemp();
    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });

    const session = (await (await app.request("/api/session")).json()) as any;
    expect(session).toEqual({ ok: true, verrouille: false, authentifie: true });

    const journal = await app.request("/api/journal");
    expect(journal.status).toBe(200);
  });
});

describe("avec REGISTRE_PASSWORD configuré", () => {
  it("refuse les routes protégées sans cookie de session", async () => {
    contexte = creerDbTemp();
    const app = creerApp({
      db: contexte.db,
      config: { apiKey: null, model: "x", maxTokens: 1 },
      promptSysteme: PROMPT,
      motDePasse: "secret123",
    });

    const journal = await app.request("/api/journal");
    expect(journal.status).toBe(401);

    const session = (await (await app.request("/api/session")).json()) as any;
    expect(session).toEqual({ ok: true, verrouille: true, authentifie: false });
  });

  it("refuse un mauvais mot de passe, accepte le bon, puis laisse passer avec le cookie", async () => {
    contexte = creerDbTemp();
    const app = creerApp({
      db: contexte.db,
      config: { apiKey: null, model: "x", maxTokens: 1 },
      promptSysteme: PROMPT,
      motDePasse: "secret123",
    });

    const echec = await app.request("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ motDePasse: "mauvais" }),
    });
    expect(echec.status).toBe(401);

    const succes = await app.request("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ motDePasse: "secret123" }),
    });
    expect(succes.status).toBe(200);
    const cookie = extraireCookie(succes);
    expect(cookie).toContain("registre_session=");

    const journalSansCookie = await app.request("/api/journal");
    expect(journalSansCookie.status).toBe(401);

    const journalAvecCookie = await app.request("/api/journal", { headers: { cookie } });
    expect(journalAvecCookie.status).toBe(200);

    const session = (await (await app.request("/api/session", { headers: { cookie } })).json()) as any;
    expect(session.authentifie).toBe(true);
  });

  it("le logout invalide la session", async () => {
    contexte = creerDbTemp();
    const app = creerApp({
      db: contexte.db,
      config: { apiKey: null, model: "x", maxTokens: 1 },
      promptSysteme: PROMPT,
      motDePasse: "secret123",
    });

    const login = await app.request("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ motDePasse: "secret123" }),
    });
    const cookie = extraireCookie(login);
    expect((await app.request("/api/journal", { headers: { cookie } })).status).toBe(200);

    const logout = await app.request("/api/logout", { method: "POST", headers: { cookie } });
    expect(logout.status).toBe(200);
    const cookieApresLogout = extraireCookie(logout);

    const apresLogout = await app.request("/api/journal", { headers: { cookie: cookieApresLogout } });
    expect(apresLogout.status).toBe(401);
  });

  it("bloque après trop de tentatives échouées", async () => {
    contexte = creerDbTemp();
    reinitialiser("inconnu"); // adresseClient() retombe sur "inconnu" en dehors de @hono/node-server
    const app = creerApp({
      db: contexte.db,
      config: { apiKey: null, model: "x", maxTokens: 1 },
      promptSysteme: PROMPT,
      motDePasse: "secret123",
    });

    let dernier: Response | null = null;
    for (let i = 0; i < 11; i++) {
      dernier = await app.request("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ motDePasse: "mauvais" }),
      });
    }
    expect(dernier!.status).toBe(429);
    reinitialiser("inconnu");
  });
});
