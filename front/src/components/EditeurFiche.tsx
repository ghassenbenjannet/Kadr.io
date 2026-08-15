export interface OptionChamp {
  valeur: string;
  label: string;
}

export interface DescripteurChamp {
  cle: string;
  label: string;
  type: "texte" | "textarea" | "select";
  options?: OptionChamp[];
}

/** Formulaire générique pour l'édition directe (immédiate, sans validation IA) d'une fiche objet. */
export function EditeurFiche({
  champs,
  valeurs,
  onChange,
}: {
  champs: DescripteurChamp[];
  valeurs: Record<string, string>;
  onChange: (cle: string, valeur: string) => void;
}) {
  return (
    <div className="editeur-fiche">
      {champs.map((c) => (
        <div className="champ" key={c.cle}>
          <label className="champ__label" htmlFor={`champ-${c.cle}`}>
            {c.label}
          </label>
          {c.type === "select" ? (
            <select id={`champ-${c.cle}`} value={valeurs[c.cle] ?? ""} onChange={(e) => onChange(c.cle, e.target.value)}>
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
            />
          ) : (
            <input
              id={`champ-${c.cle}`}
              type="text"
              value={valeurs[c.cle] ?? ""}
              onChange={(e) => onChange(c.cle, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
