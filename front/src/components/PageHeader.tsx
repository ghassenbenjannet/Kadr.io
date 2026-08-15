import type { ReactNode } from "react";

interface Props {
  icone: string;
  titre: string;
  sousTitre?: string;
  children?: ReactNode;
}

/** En-tête de page façon Notion : icône, titre, sous-titre, actions optionnelles à droite. */
export function PageHeader({ icone, titre, sousTitre, children }: Props) {
  return (
    <div className="main__entete">
      <div className="main__entete-titre">
        <span className="page-icone" aria-hidden="true">
          {icone}
        </span>
        <div>
          <h1>{titre}</h1>
          {sousTitre && <div className="main__soustitre">{sousTitre}</div>}
        </div>
      </div>
      {children && <div className="main__entete-actions">{children}</div>}
    </div>
  );
}
