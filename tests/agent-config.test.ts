import { afterEach, describe, expect, it } from "vitest";
import { chargerConfig } from "../src/agent/config.js";

const VARS = ["ANTHROPIC_API_KEY", "REGISTRE_API_KEY", "REGISTRE_PROVIDER", "REGISTRE_BASE_URL", "REGISTRE_MODEL"];

function nettoyerEnv(): void {
  for (const v of VARS) delete process.env[v];
}

afterEach(() => {
  nettoyerEnv();
});

describe("chargerConfig — fournisseur par défaut", () => {
  it("est anthropic sans REGISTRE_PROVIDER, avec le modèle par défaut", () => {
    nettoyerEnv();
    const config = chargerConfig();
    expect(config.fournisseur).toBe("anthropic");
    expect(config.model).toBe("claude-sonnet-5");
    expect(config.apiKey).toBeNull();
    expect(config.baseUrl).toBeNull();
  });

  it("lit ANTHROPIC_API_KEY pour le fournisseur anthropic", () => {
    nettoyerEnv();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const config = chargerConfig();
    expect(config.apiKey).toBe("sk-ant-test");
  });
});

describe("chargerConfig — fournisseur compatible_openai", () => {
  it("bascule sur REGISTRE_PROVIDER=compatible_openai et lit REGISTRE_API_KEY/REGISTRE_BASE_URL", () => {
    nettoyerEnv();
    process.env.REGISTRE_PROVIDER = "compatible_openai";
    process.env.REGISTRE_API_KEY = "nvapi-test";
    process.env.REGISTRE_BASE_URL = "https://integrate.api.nvidia.com/v1";
    process.env.REGISTRE_MODEL = "meta/llama-3.1-405b-instruct";
    const config = chargerConfig();
    expect(config.fournisseur).toBe("compatible_openai");
    expect(config.apiKey).toBe("nvapi-test");
    expect(config.baseUrl).toBe("https://integrate.api.nvidia.com/v1");
    expect(config.model).toBe("meta/llama-3.1-405b-instruct");
  });

  it("n'a pas de modèle par défaut pour compatible_openai (chaque endpoint a ses propres noms)", () => {
    nettoyerEnv();
    process.env.REGISTRE_PROVIDER = "compatible_openai";
    const config = chargerConfig();
    expect(config.model).toBe("");
  });

  it("ignore ANTHROPIC_API_KEY quand le fournisseur est compatible_openai", () => {
    nettoyerEnv();
    process.env.REGISTRE_PROVIDER = "compatible_openai";
    process.env.ANTHROPIC_API_KEY = "sk-ant-ne-doit-pas-etre-utilise";
    const config = chargerConfig();
    expect(config.apiKey).toBeNull();
  });

  it("une valeur REGISTRE_PROVIDER inconnue retombe sur anthropic", () => {
    nettoyerEnv();
    process.env.REGISTRE_PROVIDER = "n-importe-quoi";
    const config = chargerConfig();
    expect(config.fournisseur).toBe("anthropic");
  });
});
