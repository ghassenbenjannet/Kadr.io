import { describe, expect, it } from "vitest";
import { creerJetonSession, genererSecret, jetonValide } from "../src/auth/session.js";

describe("session", () => {
  it("un jeton fraîchement créé est valide", () => {
    const secret = genererSecret();
    const jeton = creerJetonSession(secret, 1_000_000);
    expect(jetonValide(jeton, secret, 1_000_500)).toBe(true);
  });

  it("un jeton expiré est invalide", () => {
    const secret = genererSecret();
    const jeton = creerJetonSession(secret, 0, 1000); // expire à 1000
    expect(jetonValide(jeton, secret, 1000)).toBe(false);
    expect(jetonValide(jeton, secret, 1001)).toBe(false);
    expect(jetonValide(jeton, secret, 999)).toBe(true);
  });

  it("un jeton signé avec un autre secret est invalide", () => {
    const secret = genererSecret();
    const autreSecret = genererSecret();
    const jeton = creerJetonSession(secret, 0, 1_000_000);
    expect(jetonValide(jeton, autreSecret, 500)).toBe(false);
  });

  it("un jeton altéré est invalide", () => {
    const secret = genererSecret();
    const jeton = creerJetonSession(secret, 0, 1_000_000);
    const [charge] = jeton.split(".");
    const falsifie = `${Number(charge) + 999_999_999}.${jeton.split(".")[1]}`;
    expect(jetonValide(falsifie, secret, 500)).toBe(false);
  });

  it("une valeur vide, absente ou malformée est invalide", () => {
    const secret = genererSecret();
    expect(jetonValide(undefined, secret)).toBe(false);
    expect(jetonValide(null, secret)).toBe(false);
    expect(jetonValide("", secret)).toBe(false);
    expect(jetonValide("sans-point", secret)).toBe(false);
    expect(jetonValide("abc.def", secret)).toBe(false);
  });
});
