import { useEffect, useState } from "react";
import { recupererChamps, type GroupeSourceDeVerite } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";

export function ChampsSourceVerite() {
  const [groupes, setGroupes] = useState<GroupeSourceDeVerite[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    recupererChamps()
      .then((r) => setGroupes(r.groupes))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <PageHeader groupe="Cartographie" titre="Champs par source de vérité">
        <ActionsGlobales />
      </PageHeader>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && groupes === null && <div className="chargement">Chargement…</div>}
      {!erreur && groupes !== null && groupes.length === 0 && (
        <div className="etat-vide">Aucun champ décrit pour l'instant.</div>
      )}
      {!erreur &&
        groupes !== null &&
        groupes.map((g) => (
          <div className="constats-groupe" key={g.source}>
            <div className="constats-groupe__titre">{g.source}</div>
            <div className="tableau-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Système</th>
                    <th>Module</th>
                    <th>Champ</th>
                    <th>Éditabilité</th>
                  </tr>
                </thead>
                <tbody>
                  {g.champs.map((c) => (
                    <tr key={c.id}>
                      <td>{c.systeme}</td>
                      <td>{c.module}</td>
                      <td>
                        {c.nom}
                        {c.contredit && <span className="badge badge--attention" style={{ marginLeft: "var(--e-2)" }}>⚠ contredit sa source</span>}
                      </td>
                      <td>{c.editable === null ? "non déclarée" : c.editable === 1 ? "éditable" : "lecture seule"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}
