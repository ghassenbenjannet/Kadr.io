import { useEffect, useState } from "react";
import { recupererDemandes, type DemandeComplete } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { EntiteDetail } from "./EntiteDetail";

const COLONNES: { statut: string[]; titre: string }[] = [
  { statut: ["recue"], titre: "Reçue" },
  { statut: ["qualifiee"], titre: "Qualifiée" },
  { statut: ["arbitree"], titre: "Arbitrée" },
  { statut: ["realisee"], titre: "Réalisée" },
  { statut: ["refusee", "reportee"], titre: "Écartée" },
];

function ageEnJours(iso: string): number {
  const jours = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return Math.floor(jours);
}

function CarteDemande({ demande, onClick }: { demande: DemandeComplete; onClick: () => void }) {
  const age = ageEnJours(demande.cree_le);
  return (
    <button className="ticket ticket--cliquable" onClick={onClick}>
      <div className="ticket__entete">
        <span className="badge badge--neutre">{demande.equipe}</span>
        {demande.priorite && <span className="ticket__priorite">{demande.priorite}</span>}
      </div>
      <div className="ticket__expression">{demande.expression_brute}</div>
      <div className="ticket__pied">
        <span>{demande.demandeur}</span>
        <span>{age === 0 ? "aujourd'hui" : `il y a ${age} j`}</span>
      </div>
    </button>
  );
}

export function Tickets() {
  const [demandes, setDemandes] = useState<DemandeComplete[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [idSelectionne, setIdSelectionne] = useState<string | null>(null);

  useEffect(() => {
    recupererDemandes()
      .then((r) => setDemandes(r.demandes))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  if (idSelectionne) {
    return <EntiteDetail entite="demande" id={idSelectionne} onRetour={() => setIdSelectionne(null)} />;
  }

  return (
    <div>
      <PageHeader
        icone="▥"
        titre="Tickets"
        sousTitre="Les demandes, de leur réception à leur réalisation — le statut se fait avancer en conversation."
      />

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && demandes === null && <div className="chargement">Chargement…</div>}
      {!erreur && demandes !== null && demandes.length === 0 && (
        <div className="etat-vide">Aucune demande enregistrée pour l'instant.</div>
      )}
      {!erreur && demandes !== null && demandes.length > 0 && (
        <div className="kanban">
          {COLONNES.map((colonne) => {
            const items = demandes.filter((d) => colonne.statut.includes(d.statut));
            return (
              <div className="kanban__colonne" key={colonne.titre}>
                <div className="kanban__entete">
                  <span>{colonne.titre}</span>
                  <span className="kanban__compte">{items.length}</span>
                </div>
                <div className="kanban__cartes">
                  {items.length === 0 && <div className="kanban__vide">—</div>}
                  {items.map((d) => (
                    <CarteDemande demande={d} key={d.id} onClick={() => setIdSelectionne(d.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
