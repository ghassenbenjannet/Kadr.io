import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cheminCredentials, chargerCredentials, sauvegarderCredentials } from "../src/zoho/credentials.js";

describe("credentials Zoho — stockage local, jamais dans la DB ni un commit", () => {
  let homeTemp: string;
  let homeOriginal: string | undefined;

  beforeEach(() => {
    homeTemp = mkdtempSync(join(tmpdir(), "registre-si-home-"));
    homeOriginal = process.env.HOME;
    process.env.HOME = homeTemp;
  });

  afterEach(() => {
    process.env.HOME = homeOriginal;
    rmSync(homeTemp, { recursive: true, force: true });
  });

  it("écrit le fichier avec permissions 600 et le relit", () => {
    sauvegarderCredentials({
      client_id: "id",
      client_secret: "secret",
      refresh_token: "rt-123",
      api_domain: "https://www.zohoapis.eu",
    });

    const chemin = cheminCredentials();
    expect(chemin).toContain(".registre-si");
    expect(chemin.endsWith("zoho-credentials.json")).toBe(true);

    const stats = statSync(chemin);
    expect(stats.mode & 0o777).toBe(0o600);

    const relu = chargerCredentials();
    expect(relu?.refresh_token).toBe("rt-123");
  });

  it("retourne null si aucun fichier n'existe encore", () => {
    expect(chargerCredentials()).toBeNull();
  });
});

describe("le chemin des credentials Zoho est ignoré par git", () => {
  it(".gitignore contient bien le dossier et le nom de fichier des credentials", () => {
    const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf-8");
    expect(gitignore).toMatch(/\.registre-si/);
    expect(gitignore).toMatch(/zoho-credentials\.json/);
  });
});
