import { badgeEntite, LIBELLES_ENTITE } from "../lib/entite-libelles";
import { iconeEntite } from "../lib/icones";

/** Badge type d'entité journal — icône + libellé, même correspondance icône partout où l'entité apparaît (Prompt N). */
export function BadgeEntite({ entite }: { entite: string }) {
  const Icone = iconeEntite(entite);
  return (
    <span className={badgeEntite(entite)}>
      <Icone size={12} aria-hidden="true" />
      {LIBELLES_ENTITE[entite] ?? entite}
    </span>
  );
}
