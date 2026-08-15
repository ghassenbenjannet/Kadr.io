export interface OptionChamp {
  valeur: string;
  label: string;
}

export interface DescripteurChamp {
  cle: string;
  label: string;
  type: "texte" | "textarea" | "select";
  options?: OptionChamp[];
  /** Purement indicatif (astérisque) : la validation des champs requis reste à la charge de l'appelant. */
  requis?: boolean;
}

/** Formulaire générique pour l'édition directe (immédiate, sans validation IA) d'une fiche objet. */
export function EditeurFiche({
  champs,
  valeurs,
  onChange,
  erreurs,
}: {
  champs: DescripteurChamp[];
  valeurs: Record<string, string>;
  onChange: (cle: string, valeur: string) => void;
  /** Erreur inline par champ (clé = DescripteurChamp.cle), affichée sous l'input concerné. */
  erreurs?: Record<string, string>;
}) {
  return (
    <div className="editeur-fiche">
      {champs.map((c) => {
        const erreurChamp = erreurs?.[c.cle];
        return (
          <div className="champ" key={c.cle}>
            <label className="champ__label" htmlFor={`champ-${c.cle}`}>
              {c.label}
              {c.requis ? " *" : ""}
            </label>
            {c.type === "select" ? (
              <select
                id={`champ-${c.cle}`}
                value={valeurs[c.cle] ?? ""}
                onChange={(e) => onChange(c.cle, e.target.value)}
                aria-invalid={!!erreurChamp}
                aria-describedby={erreurChamp ? `champ-${c.cle}-erreur` : undefined}
              >
                {c.options!.map((o) => (
                  <option key={o.valeur} value={o.valeur}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : c.type === "textarea" ? (
              <textarea
                id={`champ-${c.cle}`}
                value={valeurs[c.cle] ?? ""}
                onChange={(e) => onChange(c.cle, e.target.value)}
                rows={3}
                aria-invalid={!!erreurChamp}
                aria-describedby={erreurChamp ? `champ-${c.cle}-erreur` : undefined}
              />
            ) : (
              <input
                id={`champ-${c.cle}`}
                type="text"
                value={valeurs[c.cle] ?? ""}
                onChange={(e) => onChange(c.cle, e.target.value)}
                aria-invalid={!!erreurChamp}
                aria-describedby={erreurChamp ? `champ-${c.cle}-erreur` : undefined}
              />
            )}
            {erreurChamp && (
              <div className="champ__erreur" id={`champ-${c.cle}-erreur`} role="alert">
                {erreurChamp}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
