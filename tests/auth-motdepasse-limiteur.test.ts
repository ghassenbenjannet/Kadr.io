import { describe, expect, it } from "vitest";
import { motDePasseValide } from "../src/auth/motdepasse.js";
import { enregistrerEchec, limiteAtteinte, reinitialiser } from "../src/auth/limiteur.js";

describe("motDePasseValide", () => {
  it("accepte le bon mot de passe", () => {
    expect(motDePasseValide("secret123", "secret123")).toBe(true);
  });

  it("refuse un mot de passe différent", () => {
    expect(motDePasseValide("mauvais", "secret123")).toBe(false);
  });

  it("refuse une saisie vide", () => {
    expect(motDePasseValide("", "secret123")).toBe(false);
  });

  it("est sensible à la casse", () => {
    expect(motDePasseValide("Secret123", "secret123")).toBe(false);
  });
});

describe("limiteur de tentatives", () => {
  it("n'est pas atteint avant le seuil", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 9; i++) enregistrerEchec(ip, 1000);
    expect(limiteAtteinte(ip, 1000)).toBe(false);
  });

  it("bloque après 10 échecs, puis débloque après la fenêtre", () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 10; i++) enregistrerEchec(ip, 1000);
    expect(limiteAtteinte(ip, 1000)).toBe(true);
    expect(limiteAtteinte(ip, 1000 + 15 * 60 * 1000 - 1)).toBe(true);
    expect(limiteAtteinte(ip, 1000 + 15 * 60 * 1000 + 1)).toBe(false);
  });

  it("réinitialise le compteur après la fenêtre glissante", () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < 9; i++) enregistrerEchec(ip, 1000);
    // Bien après la fenêtre : le compteur repart de zéro, un seul échec ne bloque pas.
    enregistrerEchec(ip, 1000 + 16 * 60 * 1000);
    expect(limiteAtteinte(ip, 1000 + 16 * 60 * 1000)).toBe(false);
  });

  it("reinitialiser() efface l'état d'une IP", () => {
    const ip = "10.0.0.4";
    for (let i = 0; i < 10; i++) enregistrerEchec(ip, 1000);
    expect(limiteAtteinte(ip, 1000)).toBe(true);
    reinitialiser(ip);
    expect(limiteAtteinte(ip, 1000)).toBe(false);
  });
});
