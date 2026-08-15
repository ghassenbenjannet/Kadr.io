import type { ReactNode } from "react";

interface Props {
  groupe: string;
  titre: string;
  children?: ReactNode;
}

/** En-tête de page : repère de section (eyebrow) + titre + actions optionnelles à droite. */
export function PageHeader({ groupe, titre, children }: Props) {
  return (
    <div className="main__entete">
      <div className="main__entete-titre">
        <div>
          <div className="main__eyebrow">{groupe}</div>
          <h1>{titre}</h1>
        </div>
      </div>
      {children && <div className="main__entete-actions">{children}</div>}
    </div>
  );
}
