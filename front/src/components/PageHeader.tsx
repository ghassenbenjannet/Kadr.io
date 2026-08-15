import type { ReactNode } from "react";
import { ICONES_NAV } from "../lib/icones";
import type { Vue } from "../lib/navigation";

interface Props {
  vue: Vue;
  groupe: string;
  titre: string;
  children?: ReactNode;
}

/** En-tête de page : icône de vue (même icône que la nav, réutilisée) + repère de section (eyebrow) + titre + actions optionnelles à droite. */
export function PageHeader({ vue, groupe, titre, children }: Props) {
  const Icone = ICONES_NAV[vue];
  return (
    <div className="main__entete">
      <div className="main__entete-titre">
        <span className="page-icone" aria-hidden="true">
          <Icone size={20} />
        </span>
        <div>
          <div className="main__eyebrow">{groupe}</div>
          <h1>{titre}</h1>
        </div>
      </div>
      {children && <div className="main__entete-actions">{children}</div>}
    </div>
  );
}
