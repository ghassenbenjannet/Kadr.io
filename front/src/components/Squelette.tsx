/** Squelettes de chargement ayant la forme du contenu qui arrive — jamais un spinner central (Prompt N). */

export function SqueletteListe({ lignes = 5 }: { lignes?: number }) {
  return (
    <div className="squelette-liste" aria-hidden="true">
      {Array.from({ length: lignes }).map((_, i) => (
        <div className="squelette-ligne" key={i}>
          <div className="squelette-bloc squelette-bloc--date" />
          <div className="squelette-bloc squelette-bloc--badge" />
          <div className="squelette-bloc squelette-bloc--texte" />
        </div>
      ))}
    </div>
  );
}

export function SqueletteTexte({ lignes = 3 }: { lignes?: number }) {
  return (
    <div className="squelette-texte" aria-hidden="true">
      {Array.from({ length: lignes }).map((_, i) => (
        <div className="squelette-bloc squelette-bloc--ligne-texte" key={i} />
      ))}
    </div>
  );
}

export function SqueletteFiche() {
  return (
    <div className="squelette-fiche" aria-hidden="true">
      <div className="squelette-bloc squelette-bloc--titre" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div className="squelette-fiche__ligne" key={i}>
          <div className="squelette-bloc squelette-bloc--label" />
          <div className="squelette-bloc squelette-bloc--valeur" />
        </div>
      ))}
    </div>
  );
}
