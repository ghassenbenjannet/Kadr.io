import { useEffect, useState } from "react";
import { recupererConstats, type ConstatOuvert } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";

type Famille = "pratique" | "modele" | "integration";

function familleDuControle(controle: string): Famille {
  if (controle.startsWith("C")) return "pratique";
  if (controle.startsWith("M")) return "modele";
  return "integration";
}

const TITRES_FAMILLE: Record<Famille, string> = {
  pratique: "Journal",
  modele: "Modèle",
  integration: "Intégration",
};

export function Constats() {
  const [constats, setConstats] = useState<ConstatOuvert[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    recupererConstats()
      .then((r) => setConstats(r.constats))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  const groupes: Record<Famille, ConstatOuvert[]> = { pratique: [], modele: [], integration: [] };
  for (const c of constats ?? []) {
    groupes[familleDuControle(c.controle)].push(c);
  }

  return (
    <div>
      <PageHeader groupe="Mémoire" titre="Constats">
        <ActionsGlobales />
      </PageHeader>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && constats === null && <div className="chargement">Chargement…</div>}
      {!erreur && constats !== null && constats.length === 0 && (
        <div className="etat-vide">Aucun point de vigilance ouvert.</div>
      )}
      {!erreur &&
        constats !== null &&
        constats.length > 0 &&
        (["pratique", "modele", "integration"] as const).map((famille) =>
          groupes[famille].length === 0 ? null : (
            <div className="constats-groupe" key={famille}>
              <div className="constats-groupe__titre">
                {TITRES_FAMILLE[famille]}
                <span className="constats-groupe__titre-compte">{groupes[famille].length}</span>
              </div>
              {groupes[famille].map((c, i) => (
                <div className="constat" key={i}>
                  <div className="constat__corps">
                    <div className="constat__resume">{c.resume}</div>
                    <div className="constat__consequence">{c.consequence}</div>
                  </div>
                  <span className="constat__code mono">{c.controle}</span>
                </div>
              ))}
            </div>
          )
        )}
    </div>
  );
}
