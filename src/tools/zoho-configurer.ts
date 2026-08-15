import { z } from "zod";
import type { Resultat } from "../db/util.js";
import { echangerGrantCode, domaineCompteDepuisApi } from "../zoho/client.js";
import { sauvegarderCredentials } from "../zoho/credentials.js";

export const nom = "zoho_configurer";

export const description =
  "Configure l'accès à l'API Zoho via un Self Client OAuth2 (console développeur Zoho) : échange " +
  "le grant code contre un refresh token et le stocke localement (~/.registre-si, permissions " +
  "600, jamais dans la DB ni dans un commit). À faire une seule fois, avant zoho_decouvrir.";

export const schemaEntree = {
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  grant_code: z.string().min(1).describe("Grant code généré dans la console développeur Zoho (usage unique)"),
};

const schema = z.object(schemaEntree);
export type EntreeZohoConfigurer = z.infer<typeof schema>;

interface Sortie {
  message: string;
  api_domain: string;
}

export async function zohoConfigurer(entree: EntreeZohoConfigurer): Promise<Resultat<Sortie>> {
  const domaineApiParDefaut = process.env.ZOHO_API_DOMAIN ?? "https://www.zohoapis.eu";
  const domaineCompte = domaineCompteDepuisApi(domaineApiParDefaut);

  try {
    const echange = await echangerGrantCode(entree.client_id, entree.client_secret, entree.grant_code, domaineCompte);
    const apiDomain = echange.api_domain ?? domaineApiParDefaut;

    sauvegarderCredentials({
      client_id: entree.client_id,
      client_secret: entree.client_secret,
      refresh_token: echange.refresh_token,
      api_domain: apiDomain,
    });

    return {
      ok: true,
      message: "Identifiants Zoho enregistrés. Le refresh token est stocké dans ~/.registre-si/zoho-credentials.json.",
      api_domain: apiDomain,
    };
  } catch (erreur) {
    return { ok: false, erreur: erreur instanceof Error ? erreur.message : String(erreur) };
  }
}
