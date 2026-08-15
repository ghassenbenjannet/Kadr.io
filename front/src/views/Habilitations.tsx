import { useEffect, useState } from "react";
import { recupererHabilitations, type ChampAvecContexte, type DroitCellule } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";

function libelleCellule(droit: DroitCellule | undefined): { texte: string; classe: string } {
  switch (droit) {
    case "editable":
      return { texte: "Édite", classe: "editable" };
    case "visible":
      return { texte: "Visible", classe: "" };
    case "masque":
      return { texte: "Masqué", classe: "masque" };
    default:
      return { texte: "non déclaré", classe: "non-declare" };
  }
}

export function Habilitations() {
  const [moduleFiltre, setModuleFiltre] = useState("");
  const [donnees, setDonnees] = useState<{
    champs: ChampAvecContexte[];
    profils: string[];
    modules: string[];
    cellules: Record<string, DroitCellule>;
  } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setErreur(null);
    recupererHabilitations(moduleFiltre || undefined)
      .then((r) => {
        if (!annule) setDonnees(r);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      });
    return () => {
      annule = true;
    };
  }, [moduleFiltre]);

  return (
    <div>
      <PageHeader vue="habilitations" groupe="Cartographie" titre="Matrice d'habilitations">
        <ActionsGlobales />
      </PageHeader>

      {donnees && donnees.modules.length > 0 && (
        <div className="filtre">
          <select
            value={moduleFiltre}
            onChange={(e) => setModuleFiltre(e.target.value)}
            aria-label="Filtrer par module"
          >
            <option value="">Tous les modules</option>
            {donnees.modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && donnees === null && <div className="chargement">Chargement…</div>}
      {!erreur && donnees !== null && donnees.champs.length === 0 && (
        <div className="etat-vide">Aucun champ décrit{moduleFiltre ? ` pour le module « ${moduleFiltre} »` : ""}.</div>
      )}
      {!erreur && donnees !== null && donnees.champs.length > 0 && donnees.profils.length === 0 && (
        <div className="etat-vide">Aucune habilitation décrite pour l'instant.</div>
      )}
      {!erreur && donnees !== null && donnees.champs.length > 0 && donnees.profils.length > 0 && (
        <div className="tableau-scroll">
          <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>Champ</th>
                {donnees.profils.map((p) => (
                  <th className="centre" key={p}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donnees.champs.map((c) => (
                <tr key={c.id}>
                  <td>{c.module}</td>
                  <td>{c.nom}</td>
                  {donnees.profils.map((p) => {
                    const { texte, classe } = libelleCellule(donnees.cellules[`${c.id}|${p}`]);
                    return (
                      <td className={`centre ${classe}`} key={p}>
                        {texte}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="main__soustitre" style={{ marginTop: "var(--e-3)" }}>
            « non déclaré » signifie qu'aucune habilitation n'a été décrite pour ce profil sur ce champ — ce n'est
            pas équivalent à « masqué ».
          </p>
        </div>
      )}
    </div>
  );
}
