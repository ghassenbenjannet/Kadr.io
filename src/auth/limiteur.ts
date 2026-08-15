// Limite les tentatives de connexion par IP — le mot de passe est unique et
// partagé, la seule vraie menace ici est le bruteforce. En mémoire : pas
// besoin de persistance pour un compteur qui doit justement repartir de
// zéro à chaque redémarrage.

const MAX_ECHECS = 10;
const FENETRE_MS = 15 * 60 * 1000; // 15 minutes glissantes avant réinitialisation du compteur
const BLOCAGE_MS = 15 * 60 * 1000; // durée du blocage une fois la limite atteinte

interface Etat {
  echecs: number;
  premierEchecA: number;
  bloqueJusqua: number | null;
}

const etatsParIp = new Map<string, Etat>();

export function limiteAtteinte(ip: string, maintenant = Date.now()): boolean {
  const etat = etatsParIp.get(ip);
  return !!etat?.bloqueJusqua && maintenant < etat.bloqueJusqua;
}

export function enregistrerEchec(ip: string, maintenant = Date.now()): void {
  let etat = etatsParIp.get(ip);
  if (!etat || maintenant - etat.premierEchecA > FENETRE_MS) {
    etat = { echecs: 0, premierEchecA: maintenant, bloqueJusqua: null };
  }
  etat.echecs += 1;
  if (etat.echecs >= MAX_ECHECS) {
    etat.bloqueJusqua = maintenant + BLOCAGE_MS;
  }
  etatsParIp.set(ip, etat);
}

export function reinitialiser(ip: string): void {
  etatsParIp.delete(ip);
}
