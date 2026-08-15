import { useEffect, useState } from "react";
import {
  recupererDemandes,
  recupererTickets,
  recupererProjets,
  recupererProjet,
  recupererVuesKanban,
  sauvegarderVueKanbanDirect,
  supprimerVueKanbanDirect,
  type DemandeComplete,
  type TicketAvecContexte,
  type ProjetResume,
  type EpicDetail,
  type EntiteKanban,
  type VueKanban,
} from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";
import { EntiteDetail } from "./EntiteDetail";
import { TicketDetail } from "./TicketDetail";
import { LIBELLES_TYPE_TICKET } from "../lib/tickets-libelles";

const COLONNES_DEMANDE: { statut: string[]; titre: string }[] = [
  { statut: ["recue"], titre: "Reçue" },
  { statut: ["qualifiee"], titre: "Qualifiée" },
  { statut: ["arbitree"], titre: "Arbitrée" },
  { statut: ["realisee"], titre: "Réalisée" },
  { statut: ["refusee", "reportee"], titre: "Écartée" },
];

const COLONNES_TICKET: { statut: string[]; titre: string }[] = [
  { statut: ["a_faire"], titre: "À faire" },
  { statut: ["en_cours"], titre: "En cours" },
  { statut: ["bloque"], titre: "Bloqué" },
  { statut: ["termine"], titre: "Terminé" },
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

function CarteTicket({ ticket, onClick }: { ticket: TicketAvecContexte; onClick: () => void }) {
  return (
    <button className="carte-ticket carte-ticket--cliquable" onClick={onClick}>
      <div className="carte-ticket__entete">
        <span className="badge badge--neutre">{LIBELLES_TYPE_TICKET[ticket.type] ?? ticket.type}</span>
      </div>
      <div className="carte-ticket__titre">{ticket.titre}</div>
      <div className="carte-ticket__contexte">
        {ticket.projet_nom} / {ticket.epic_nom}
      </div>
    </button>
  );
}

export function Kanban() {
  const [entite, setEntite] = useState<EntiteKanban>("demande");
  const [filtreProjet, setFiltreProjet] = useState("");
  const [filtreEpic, setFiltreEpic] = useState("");
  const [projets, setProjets] = useState<ProjetResume[]>([]);
  const [epicsDuProjet, setEpicsDuProjet] = useState<EpicDetail[]>([]);
  const [demandes, setDemandes] = useState<DemandeComplete[] | null>(null);
  const [tickets, setTickets] = useState<TicketAvecContexte[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ kind: "demande" | "ticket"; id: string } | null>(null);

  const [vues, setVues] = useState<VueKanban[]>([]);
  const [vueActiveId, setVueActiveId] = useState<string>("");
  const [enregistrementOuvert, setEnregistrementOuvert] = useState(false);
  const [nomVue, setNomVue] = useState("");

  useEffect(() => {
    recupererProjets()
      .then((r) => setProjets(r.projets))
      .catch(() => setProjets([]));
    rechargerVues();
  }, []);

  useEffect(() => {
    if (entite !== "ticket" || !filtreProjet) {
      setEpicsDuProjet([]);
      return;
    }
    recupererProjet(filtreProjet)
      .then((r) => setEpicsDuProjet(r.epics))
      .catch(() => setEpicsDuProjet([]));
  }, [entite, filtreProjet]);

  function charger() {
    setErreur(null);
    if (entite === "demande") {
      setDemandes(null);
      return recupererDemandes({ projetId: filtreProjet || undefined })
        .then((r) => setDemandes(r.demandes))
        .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
    }
    setTickets(null);
    return recupererTickets({ projetId: filtreProjet || undefined, epicId: filtreEpic || undefined })
      .then((r) => setTickets(r.tickets))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entite, filtreProjet, filtreEpic]);

  function rechargerVues() {
    return recupererVuesKanban()
      .then((r) => setVues(r.vues))
      .catch(() => setVues([]));
  }

  function changerEntite(e: EntiteKanban) {
    setEntite(e);
    setFiltreProjet("");
    setFiltreEpic("");
    setVueActiveId("");
  }

  function chargerVue(id: string) {
    setVueActiveId(id);
    if (!id) return;
    const vue = vues.find((v) => v.id === id);
    if (!vue) return;
    setEntite(vue.entite);
    setFiltreProjet(vue.filtres.projet_id ?? "");
    setFiltreEpic(vue.filtres.epic_id ?? "");
  }

  async function enregistrerVue() {
    if (!nomVue.trim()) return;
    try {
      await sauvegarderVueKanbanDirect({
        nom: nomVue.trim(),
        entite,
        filtres: { projet_id: filtreProjet || undefined, epic_id: filtreEpic || undefined },
      });
      setNomVue("");
      setEnregistrementOuvert(false);
      await rechargerVues();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function supprimerVueActive() {
    if (!vueActiveId) return;
    if (!confirm("Supprimer cette vue enregistrée ?")) return;
    try {
      await supprimerVueKanbanDirect(vueActiveId);
      setVueActiveId("");
      await rechargerVues();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  if (selection?.kind === "demande") {
    return (
      <EntiteDetail
        entite="demande"
        id={selection.id}
        onRetour={() => {
          setSelection(null);
          charger();
        }}
      />
    );
  }
  if (selection?.kind === "ticket") {
    return (
      <TicketDetail
        id={selection.id}
        onRetour={() => {
          setSelection(null);
          charger();
        }}
      />
    );
  }

  const donnees = entite === "demande" ? demandes : tickets;
  const colonnes = entite === "demande" ? COLONNES_DEMANDE : COLONNES_TICKET;

  return (
    <div>
      <PageHeader vue="kanban" groupe="Pilotage" titre="Kanban">
        <ActionsGlobales />
      </PageHeader>

      <div className="pilules" style={{ marginBottom: "var(--e-3)" }}>
        <button
          className={`pilule${entite === "demande" ? " pilule--actif" : ""}`}
          onClick={() => changerEntite("demande")}
        >
          Demandes
        </button>
        <button
          className={`pilule${entite === "ticket" ? " pilule--actif" : ""}`}
          onClick={() => changerEntite("ticket")}
        >
          Tickets
        </button>
      </div>

      <div className="filtre">
        {entite === "ticket" && (
          <>
            <select
              value={filtreProjet}
              onChange={(e) => {
                setFiltreProjet(e.target.value);
                setFiltreEpic("");
                setVueActiveId("");
              }}
              aria-label="Filtrer par projet"
            >
              <option value="">Tous les projets</option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
            <select
              value={filtreEpic}
              onChange={(e) => {
                setFiltreEpic(e.target.value);
                setVueActiveId("");
              }}
              aria-label="Filtrer par epic"
              disabled={!filtreProjet}
            >
              <option value="">Tous les epics</option>
              {epicsDuProjet.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.nom}
                </option>
              ))}
            </select>
          </>
        )}
        {entite === "demande" && (
          <select
            value={filtreProjet}
            onChange={(e) => {
              setFiltreProjet(e.target.value);
              setVueActiveId("");
            }}
            aria-label="Filtrer par projet"
          >
            <option value="">Tous les projets</option>
            {projets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        )}

        <select value={vueActiveId} onChange={(e) => chargerVue(e.target.value)} aria-label="Charger une vue">
          <option value="">Vues enregistrées…</option>
          {vues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nom}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => setEnregistrementOuvert((v) => !v)}>
          {enregistrementOuvert ? "Fermer" : "Enregistrer la vue"}
        </button>
        {vueActiveId && (
          <button className="btn btn--danger" onClick={supprimerVueActive}>
            Supprimer la vue
          </button>
        )}
      </div>

      {enregistrementOuvert && (
        <div className="filtre">
          <input
            type="text"
            placeholder="Nom de la vue"
            value={nomVue}
            onChange={(e) => setNomVue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enregistrerVue()}
          />
          <button className="btn btn--primaire" onClick={enregistrerVue} disabled={!nomVue.trim()}>
            Enregistrer
          </button>
        </div>
      )}

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && donnees === null && <div className="chargement">Chargement…</div>}
      {!erreur && donnees !== null && donnees.length === 0 && (
        <div className="etat-vide">
          {entite === "demande" ? "Aucune demande enregistrée pour l'instant." : "Aucun ticket pour l'instant."}
        </div>
      )}
      {!erreur && donnees !== null && donnees.length > 0 && (
        <div className="kanban">
          {colonnes.map((colonne) => {
            const items =
              entite === "demande"
                ? (demandes ?? []).filter((d) => colonne.statut.includes(d.statut))
                : (tickets ?? []).filter((t) => colonne.statut.includes(t.statut));
            return (
              <div className="kanban__colonne" key={colonne.titre}>
                <div className="kanban__entete">
                  <span>{colonne.titre}</span>
                  <span className="kanban__compte">{items.length}</span>
                </div>
                <div className="kanban__cartes">
                  {items.length === 0 && <div className="kanban__vide">—</div>}
                  {entite === "demande"
                    ? (items as DemandeComplete[]).map((d) => (
                        <CarteDemande demande={d} key={d.id} onClick={() => setSelection({ kind: "demande", id: d.id })} />
                      ))
                    : (items as TicketAvecContexte[]).map((t) => (
                        <CarteTicket ticket={t} key={t.id} onClick={() => setSelection({ kind: "ticket", id: t.id })} />
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
