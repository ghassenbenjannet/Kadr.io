// Client HTTP Zoho (§2, §8.2 spec technique Jalon 3). Séparé de mapper.ts et
// fusion.ts (fonctions pures) : c'est ici, et seulement ici, que des appels
// réseau ont lieu. Le transport est injectable pour les tests — aucun appel
// réel n'est fait dans la suite de tests.

export interface ReponseHttp {
  status: number;
  headers: { get(nom: string): string | null };
  ok: boolean;
  json(): Promise<unknown>;
}

export interface TransportHttp {
  fetch(url: string, init?: { method?: string; headers?: Record<string, string> }): Promise<ReponseHttp>;
}

export const transportFetchNatif: TransportHttp = {
  fetch: (url, init) => fetch(url, init) as unknown as Promise<ReponseHttp>,
};

/** Dérive le domaine de compte OAuth (pour le rafraîchissement de token) du domaine API. */
export function domaineCompteDepuisApi(domaineApi: string): string {
  const m = /^https:\/\/www\.zohoapis\.(.+)$/.exec(domaineApi);
  const tld = m?.[1] ?? "eu";
  return `https://accounts.zoho.${tld}`;
}

export interface OptionsClientZoho {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  domaineApi?: string;
  transport?: TransportHttp;
  attendre?: (ms: number) => Promise<void>;
  tentativesMax?: number;
}

const DOMAINE_API_DEFAUT = "https://www.zohoapis.eu";

export class ClientZoho {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly domaineApi: string;
  private readonly domaineCompte: string;
  private readonly transport: TransportHttp;
  private readonly attendre: (ms: number) => Promise<void>;
  private readonly tentativesMax: number;

  private accessToken: string | null = null;
  private accessTokenExpireA = 0;

  constructor(options: OptionsClientZoho) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.refreshToken = options.refreshToken;
    this.domaineApi = options.domaineApi ?? process.env.ZOHO_API_DOMAIN ?? DOMAINE_API_DEFAUT;
    this.domaineCompte = domaineCompteDepuisApi(this.domaineApi);
    this.transport = options.transport ?? transportFetchNatif;
    this.attendre = options.attendre ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.tentativesMax = options.tentativesMax ?? 3;
  }

  private async rafraichirAccessToken(): Promise<string> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
    });
    const res = await this.transport.fetch(`${this.domaineCompte}/oauth/v2/token?${params.toString()}`, {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(`Rafraîchissement du token Zoho échoué : HTTP ${res.status}`);
    }
    const corps = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!corps.access_token) {
      throw new Error("Rafraîchissement du token Zoho échoué : réponse sans access_token");
    }
    this.accessToken = corps.access_token;
    // Marge de sécurité de 60 s avant l'expiration réelle (1 h typiquement).
    this.accessTokenExpireA = Date.now() + (corps.expires_in ?? 3600) * 1000 - 60_000;
    return this.accessToken;
  }

  private async assurerAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpireA) {
      return this.accessToken;
    }
    return this.rafraichirAccessToken();
  }

  /** GET générique sur l'API Zoho, avec backoff simple sur 429. */
  async get(cheminRelatif: string, params: Record<string, string> = {}): Promise<unknown> {
    const token = await this.assurerAccessToken();
    const requete = new URLSearchParams(params).toString();
    const url = `${this.domaineApi}${cheminRelatif}${requete ? `?${requete}` : ""}`;

    for (let tentative = 0; ; tentative++) {
      const res = await this.transport.fetch(url, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });

      if (res.status === 429 && tentative < this.tentativesMax) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? "");
        const delaiMs = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : (tentative + 1) * 2) * 1000;
        await this.attendre(delaiMs);
        continue;
      }

      if (!res.ok) {
        throw new Error(`Zoho API a répondu HTTP ${res.status} sur ${cheminRelatif}`);
      }
      return res.json();
    }
  }
}

export interface EchangeGrantCode {
  refresh_token: string;
  access_token: string;
  api_domain?: string;
}

/**
 * Échange un grant code (Self Client OAuth2) contre un refresh token. N'est
 * appelé qu'une fois, lors de zoho_configurer.
 */
export async function echangerGrantCode(
  clientId: string,
  clientSecret: string,
  grantCode: string,
  domaineCompte = "https://accounts.zoho.eu",
  transport: TransportHttp = transportFetchNatif
): Promise<EchangeGrantCode> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code: grantCode,
  });
  const res = await transport.fetch(`${domaineCompte}/oauth/v2/token?${params.toString()}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Échange du grant code Zoho échoué : HTTP ${res.status}`);
  }
  const corps = (await res.json()) as Partial<EchangeGrantCode> & { error?: string };
  if (corps.error || !corps.refresh_token || !corps.access_token) {
    throw new Error(`Échange du grant code Zoho échoué : ${corps.error ?? "réponse incomplète"}`);
  }
  return { refresh_token: corps.refresh_token, access_token: corps.access_token, api_domain: corps.api_domain };
}
