import type { LucideIcon } from "lucide-react";

interface Props {
  icone: LucideIcon;
  phrase: string;
  action?: { label: string; onClick: () => void };
}

/** État vide avec icône + phrase + action optionnelle — jamais un "Rien à afficher" nu (Prompt N). */
export function EtatVide({ icone: Icone, phrase, action }: Props) {
  return (
    <div className="etat-vide">
      <Icone size={28} aria-hidden="true" className="etat-vide__icone" />
      <p className="etat-vide__phrase">{phrase}</p>
      {action && (
        <button className="btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
