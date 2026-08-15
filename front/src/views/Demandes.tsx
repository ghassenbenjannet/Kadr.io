import { useEffect, useState } from "react";
import { recupererDemandes, type DemandeComplete } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";
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
    <button className="carte-demande carte-demande--cliquable" onClick={onClick}>
      <div className="carte-demande__entete">
        <span className="badge badge--neutre">{demande.equipe}</span>
        {demande.priorite && <span className="carte-demande__priorite">{demande.priorite}</span>}
      </div>
      <div className="carte-demande__expression">{demande.expression_brute}</div>
      <div className="carte-demande__pied">
        <span>{demande.demandeur}</span>
        <span>{age === 0 ? "aujourd'hui" : `il y a ${age} j`}</span>
      </div>
    </button>
  );
}

export function Demandes() {
  const [demandes, setDemandes] = useState<DemandeComplete[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [idSelectionne, setIdSelectionne] = useState<string | null>(null);

  function charger() {
    setErreur(null);
    return recupererDemandes()
      .then((r) => setDemandes(r.demandes))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    charger();
  }, []);

  if (idSelectionne) {
    return (
      <EntiteDetail
        entite="demande"
        id={idSelectionne}
        onRetour={() => {
          setIdSelectionne(null);
          charger();
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader groupe="Pilotage" titre="Demandes">
        <ActionsGlobales />
      </PageHeader>

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
