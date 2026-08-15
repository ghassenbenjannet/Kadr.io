import { useState } from "react";
import type { EcritureProposee } from "../lib/api";
import { confirmerEcriture, type ResultatConfirm } from "../lib/api";
import { libelleChamp, libelleOutil } from "../lib/outils-libelles";
import { avertissementsPourProposition } from "../lib/avertissements-proposition";

interface Props {
  ecriture: EcritureProposee;
  onTranchee: (action: "valider" | "rejeter", resultat: ResultatConfirm) => void;
}

type ValeurChamp = string | number | boolean | null | undefined;

function estValeurSimple(v: unknown): v is ValeurChamp {
  return v === null || v === undefined || ["string", "number", "boolean"].includes(typeof v);
}

export function ValidationCard({ ecriture, onTranchee }: Props) {
  const [champs, setChamps] = useState<Record<string, unknown>>(() => ({ ...ecriture.parametres }));
  const [erreursJson, setErreursJson] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<"valider" | "rejeter" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const avertissements = avertissementsPourProposition(
    ecriture.outil,
    champs as Record<string, unknown>
  );

  function modifierChamp(cle: string, valeur: unknown) {
    setChamps((c) => ({ ...c, [cle]: valeur }));
  }

  async function trancher(action: "valider" | "rejeter") {
    if (Object.keys(erreursJson).length > 0) return;
    setEnCours(action);
    setErreur(null);
    try {
      const resultat = await confirmerEcriture({
        ecritureId: ecriture.id,
        action,
        parametres: action === "valider" ? champs : undefined,
      });
      onTranchee(action, resultat);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnCours(null);
    }
  }

  return (
    <div className="carte-validation">
      <div className="carte-validation__titre">{libelleOutil(ecriture.outil)}</div>

      {avertissements.map((a, i) => (
        <div className="carte-validation__avertissement" key={i}>
          {a}
        </div>
      ))}

      <div className="carte-validation__champs">
        {Object.entries(ecriture.parametres).map(([cle, valeurInitiale]) => {
          const valeur = champs[cle];
          if (estValeurSimple(valeurInitiale)) {
            if (typeof valeurInitiale === "boolean") {
              return (
                <label className="champ champ--case" key={cle}>
                  <input
                    type="checkbox"
                    checked={Boolean(valeur)}
                    onChange={(e) => modifierChamp(cle, e.target.checked)}
                  />
                  {libelleChamp(cle)}
                </label>
              );
            }
            const texteLong = typeof valeur === "string" && (valeur.length > 60 || valeur.includes("\n"));
            return (
              <label className="champ" key={cle}>
                <span className="champ__label">{libelleChamp(cle)}</span>
                {texteLong ? (
                  <textarea
                    value={(valeur as string) ?? ""}
                    rows={3}
                    onChange={(e) => modifierChamp(cle, e.target.value)}
                  />
                ) : (
                  <input
                    type={typeof valeurInitiale === "number" ? "number" : "text"}
                    value={(valeur as string | number) ?? ""}
                    onChange={(e) =>
                      modifierChamp(cle, typeof valeurInitiale === "number" ? e.target.valueAsNumber : e.target.value)
                    }
                  />
                )}
              </label>
            );
          }

          // Objets / tableaux : édition JSON brute.
          return (
            <label className="champ" key={cle}>
              <span className="champ__label">{libelleChamp(cle)} (JSON)</span>
              <textarea
                rows={3}
                defaultValue={JSON.stringify(valeur, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    modifierChamp(cle, parsed);
                    setErreursJson((err) => {
                      const { [cle]: _retire, ...reste } = err;
                      return reste;
                    });
                  } catch {
                    setErreursJson((err) => ({ ...err, [cle]: "JSON invalide" }));
                  }
                }}
              />
              {erreursJson[cle] && <span className="champ__erreur">{erreursJson[cle]}</span>}
            </label>
          );
        })}
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      <div className="carte-validation__actions">
        <button
          className="btn btn--primaire"
          disabled={enCours !== null || Object.keys(erreursJson).length > 0}
          onClick={() => trancher("valider")}
        >
          {enCours === "valider" ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button className="btn btn--danger" disabled={enCours !== null} onClick={() => trancher("rejeter")}>
          {enCours === "rejeter" ? "Rejet…" : "Rejeter"}
        </button>
      </div>
    </div>
  );
}
