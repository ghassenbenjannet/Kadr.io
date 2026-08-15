import { describe, expect, it } from "vitest";
import { ClientZoho, echangerGrantCode, domaineCompteDepuisApi, type TransportHttp } from "../src/zoho/client.js";

function reponse(status: number, corps: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (nom: string) => headers[nom] ?? null },
    json: async () => corps,
  };
}

describe("domaineCompteDepuisApi", () => {
  it("dérive accounts.zoho.eu depuis www.zohoapis.eu", () => {
    expect(domaineCompteDepuisApi("https://www.zohoapis.eu")).toBe("https://accounts.zoho.eu");
  });
  it("dérive accounts.zoho.com depuis www.zohoapis.com", () => {
    expect(domaineCompteDepuisApi("https://www.zohoapis.com")).toBe("https://accounts.zoho.com");
  });
});

describe("echangerGrantCode", () => {
  it("retourne le refresh_token sans appel réel (transport injecté)", async () => {
    const appels: string[] = [];
    const transport: TransportHttp = {
      fetch: async (url) => {
        appels.push(url);
        return reponse(200, { refresh_token: "rt-123", access_token: "at-123", api_domain: "https://www.zohoapis.eu" });
      },
    };
    const r = await echangerGrantCode("id", "secret", "code", "https://accounts.zoho.eu", transport);
    expect(r.refresh_token).toBe("rt-123");
    expect(appels).toHaveLength(1);
    expect(appels[0]).toContain("accounts.zoho.eu/oauth/v2/token");
  });

  it("lève une erreur explicite si Zoho répond une erreur", async () => {
    const transport: TransportHttp = {
      fetch: async () => reponse(200, { error: "invalid_code" }),
    };
    await expect(echangerGrantCode("id", "secret", "mauvais-code", "https://accounts.zoho.eu", transport)).rejects.toThrow(
      /invalid_code/
    );
  });
});

describe("ClientZoho (transport injecté, aucun appel réel)", () => {
  it("rafraîchit le token puis fait un GET avec le bon header d'autorisation", async () => {
    const appels: { url: string; headers?: Record<string, string> }[] = [];
    const transport: TransportHttp = {
      fetch: async (url, init) => {
        appels.push({ url, headers: init?.headers });
        if (url.includes("/oauth/v2/token")) {
          return reponse(200, { access_token: "at-abc", expires_in: 3600 });
        }
        return reponse(200, { modules: [{ api_name: "Accounts" }] });
      },
    };
    const client = new ClientZoho({
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "rt-123",
      domaineApi: "https://www.zohoapis.eu",
      transport,
    });

    const donnees = (await client.get("/crm/v8/settings/modules")) as { modules: unknown[] };
    expect(donnees.modules).toHaveLength(1);
    expect(appels).toHaveLength(2);
    expect(appels[1]?.headers?.Authorization).toBe("Zoho-oauthtoken at-abc");
  });

  it("réutilise l'access token tant qu'il n'a pas expiré (un seul rafraîchissement)", async () => {
    let appelsToken = 0;
    const transport: TransportHttp = {
      fetch: async (url) => {
        if (url.includes("/oauth/v2/token")) {
          appelsToken++;
          return reponse(200, { access_token: "at-abc", expires_in: 3600 });
        }
        return reponse(200, { ok: true });
      },
    };
    const client = new ClientZoho({ clientId: "id", clientSecret: "s", refreshToken: "rt", transport });
    await client.get("/a");
    await client.get("/b");
    expect(appelsToken).toBe(1);
  });

  it("applique un backoff et réessaie sur 429, puis réussit", async () => {
    let tentative = 0;
    const attentes: number[] = [];
    const transport: TransportHttp = {
      fetch: async (url) => {
        if (url.includes("/oauth/v2/token")) return reponse(200, { access_token: "at", expires_in: 3600 });
        tentative++;
        if (tentative < 2) return reponse(429, {}, { "Retry-After": "1" });
        return reponse(200, { ok: true });
      },
    };
    const client = new ClientZoho({
      clientId: "id",
      clientSecret: "s",
      refreshToken: "rt",
      transport,
      attendre: async (ms) => {
        attentes.push(ms);
      },
    });
    const r = (await client.get("/x")) as { ok: boolean };
    expect(r.ok).toBe(true);
    expect(tentative).toBe(2);
    expect(attentes).toEqual([1000]);
  });

  it("abandonne après le nombre maximal de tentatives sur 429 persistant", async () => {
    const transport: TransportHttp = {
      fetch: async (url) => {
        if (url.includes("/oauth/v2/token")) return reponse(200, { access_token: "at", expires_in: 3600 });
        return reponse(429, {});
      },
    };
    const client = new ClientZoho({
      clientId: "id",
      clientSecret: "s",
      refreshToken: "rt",
      transport,
      tentativesMax: 2,
      attendre: async () => {},
    });
    await expect(client.get("/x")).rejects.toThrow(/429/);
  });
});
