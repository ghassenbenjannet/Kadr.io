import { useEffect, useState } from "react";
import {
  recupererProjet,
  creerDocumentDirect,
  mettreAJourProjetDirect,
  mettreAJourEpicDirect,
  type ProjetDetailComplet,
} from "../lib/api";
import { LIBELLES_TYPE_TICKET, badgeStatutTicket, badgeStatutCas } from "../lib/tickets-libelles";
import { LIBELLES_TYPE_DOCUMENT } from "../lib/documents-libelles";
import { OPTIONS_STATUT_PROJET, OPTIONS_STATUT_EPIC } from "../lib/statuts-libelles";
import { EditeurFiche, type DescripteurChamp } from "../components/EditeurFiche";
import { TicketDetail } from "./TicketDetail";
import { DocumentEditor } from "./DocumentEditor";

const CHAMPS_PROJET: DescripteurChamp[] = [
  { cle: "statut", label: "Statut", type: "select", options: OPTIONS_STATUT_PROJET },
  { cle: "description", label: "Description", type: "textarea" },
];

const CHAMPS_EPIC: DescripteurChamp[] = [
  { cle: "statut", label: "Statut", type: "select", options: OPTIONS_STATUT_EPIC },
  { cle: "description", label: "Description", type: "textarea" },
];

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function ProjetDetail({ id, onRetour }: { id: string; onRetour: () => void }) {
  const [detail, setDetail] = useState<ProjetDetailComplet | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ticketSelectionne, setTicketSelectionne] = useState<string | null>(null);
  const [documentSelectionne, setDocumentSelectionne] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nouveauTitre, setNouveauTitre] = useState("");
  const [nouveauType, setNouveauType] = useState("note");
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [editionProjet, setEditionProjet] = useState(false);
  const [valeursProjet, setValeursProjet] = useState<Record<string, string>>({});
  const [enregistrementProjet, setEnregistrementProjet] = useState<"inactif" | "en_cours" | "erreur">("inactif");
  const [epicEnEdition, setEpicEnEdition] = useState<string | null>(null);
  const [valeursEpic, setValeursEpic] = useState<Record<string, string>>({});
  const [enregistrementEpic, setEnregistrementEpic] = useState<"inactif" | "en_cours" | "erreur">("inactif");

  function charger() {
    let annule = false;
    setErreur(null);
    recupererProjet(id)
      .then((r) => {
        if (!annule) setDetail(r);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      });
    return () => {
      annule = true;
    };
  }

  useEffect(() => {
    setDetail(null);
    setEditionProjet(false);
    setEpicEnEdition(null);
    return charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function ouvrirEditionProjet() {
    if (!detail) return;
    setValeursProjet({ statut: detail.projet.statut, description: detail.projet.description ?? "" });
    setEditionProjet(true);
    setEnregistrementProjet("inactif");
  }

  async function enregistrerProjet() {
    if (!detail) return;
    const modifies: Record<string, string> = {};
    if (valeursProjet.statut !== detail.projet.statut && valeursProjet.statut) modifies.statut = valeursProjet.statut;
    if (valeursProjet.description !== (detail.projet.description ?? "")) {
      modifies.description = valeursProjet.description ?? "";
    }
    if (Object.keys(modifies).length === 0) {
      setEditionProjet(false);
      return;
    }
    setEnregistrementProjet("en_cours");
    try {
      await mettreAJourProjetDirect(id, modifies);
      charger();
      setEditionProjet(false);
      setEnregistrementProjet("inactif");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnregistrementProjet("erreur");
    }
  }

  function ouvrirEditionEpic(epicId: string, statut: string, description: string | null) {
    setValeursEpic({ statut, description: description ?? "" });
    setEpicEnEdition(epicId);
    setEnregistrementEpic("inactif");
  }

  async function enregistrerEpic(epicId: string, statutOriginal: string, descriptionOriginal: string | null) {
    const modifies: Record<string, string> = {};
    if (valeursEpic.statut !== statutOriginal && valeursEpic.statut) modifies.statut = valeursEpic.statut;
    if (valeursEpic.description !== (descriptionOriginal ?? "")) modifies.description = valeursEpic.description ?? "";
    if (Object.keys(modifies).length === 0) {
      setEpicEnEdition(null);
      return;
    }
    setEnregistrementEpic("en_cours");
    try {
      await mettreAJourEpicDirect(epicId, modifies);
      charger();
      setEpicEnEdition(null);
      setEnregistrementEpic("inactif");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnregistrementEpic("erreur");
    }
  }

  async function creerPage() {
    if (!detail || !nouveauTitre.trim()) return;
    setCreationEnCours(true);
    try {
      const r = await creerDocumentDirect({ projet: detail.projet.nom, type: nouveauType, titre: nouveauTitre.trim() });
      setFormulaireOuvert(false);
      setNouveauTitre("");
      setDocumentSelectionne(r.id);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setCreationEnCours(false);
    }
  }

  if (ticketSelectionne) {
    return <TicketDetail id={ticketSelectionne} onRetour={() => setTicketSelectionne(null)} />;
  }

  if (documentSelectionne) {
    return (
      <DocumentEditor
        id={documentSelectionne}
        retourLabel={detail?.projet.nom}
        onRetour={() => {
          setDocumentSelectionne(null);
          charger();
        }}
      />
    );
  }

  return (
    <div>
      <button className="lien-retour" onClick={onRetour}>
        ← Projets
      </button>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && detail === null && <div className="chargement">Chargement…</div>}

      {!erreur && detail !== null && (
        <>
          <div className="main__entete">
            <div className="main__entete-titre">
              <span className="page-icone" aria-hidden="true">
                ▣
              </span>
              <div>
                <h1>{detail.projet.nom}</h1>
                <div className="main__soustitre">
                  {detail.projet.description ?? `Projet ${detail.projet.statut}`}
                </div>
              </div>
            </div>
            {!editionProjet && (
              <div className="main__entete-actions">
                <button className="sidebar__nouvelle" onClick={ouvrirEditionProjet}>
                  Modifier
                </button>
              </div>
            )}
          </div>

          {editionProjet && (
            <>
              <EditeurFiche
                champs={CHAMPS_PROJET}
                valeurs={valeursProjet}
                onChange={(cle, valeur) => setValeursProjet((v) => ({ ...v, [cle]: valeur }))}
              />
              <div className="editeur-fiche__actions">
                <button className="btn btn--primaire" onClick={enregistrerProjet} disabled={enregistrementProjet === "en_cours"}>
                  Enregistrer
                </button>
                <button className="btn" onClick={() => setEditionProjet(false)} disabled={enregistrementProjet === "en_cours"}>
                  Annuler
                </button>
                {enregistrementProjet === "erreur" && <span className="champ__erreur">Échec de l'enregistrement</span>}
              </div>
            </>
          )}

          <div className="constats-groupe">
            <div className="constats-groupe__titre-ligne">
              <div className="constats-groupe__titre">Documentation</div>
              <button className="sidebar__nouvelle" onClick={() => setFormulaireOuvert((v) => !v)}>
                + Nouvelle page
              </button>
            </div>

            {formulaireOuvert && (
              <div className="editeur__formulaire">
                <select value={nouveauType} onChange={(e) => setNouveauType(e.target.value)} aria-label="Type de page">
                  {Object.entries(LIBELLES_TYPE_DOCUMENT).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>
                      {libelle}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Titre de la page"
                  value={nouveauTitre}
                  onChange={(e) => setNouveauTitre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && creerPage()}
                />
                <button className="btn btn--primaire" onClick={creerPage} disabled={!nouveauTitre.trim() || creationEnCours}>
                  Créer
                </button>
              </div>
            )}

            {detail.documents.length === 0 && !formulaireOuvert && (
              <div className="etat-vide">Aucune page pour l'instant.</div>
            )}
            {detail.documents.length > 0 && (
              <div className="liste">
                {detail.documents.map((doc) => (
                  <button className="ligne ligne--cliquable" key={doc.id} onClick={() => setDocumentSelectionne(doc.id)}>
                    <div className="ligne__corps">
                      <span className="badge badge--neutre">{LIBELLES_TYPE_DOCUMENT[doc.type] ?? doc.type}</span>
                      <span className="ligne__resume">{doc.titre}</span>
                      <span className="main__soustitre" style={{ marginLeft: "auto" }}>
                        {formaterDate(doc.maj_le)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {detail.epics.length === 0 && (
            <div className="etat-vide">Aucun epic pour l'instant.</div>
          )}
          {detail.epics.map((epic) => (
            <div className="constats-groupe" key={epic.id}>
              <div className="constats-groupe__titre-ligne">
                <div className="constats-groupe__titre">
                  {epic.nom} · {epic.statut.replace("_", " ")} · {epic.tickets.length} ticket
                  {epic.tickets.length === 1 ? "" : "s"}
                </div>
                {epicEnEdition !== epic.id && (
                  <button
                    className="sidebar__nouvelle"
                    onClick={() => ouvrirEditionEpic(epic.id, epic.statut, epic.description)}
                  >
                    Modifier
                  </button>
                )}
              </div>

              {epic.description && epicEnEdition !== epic.id && (
                <div className="main__soustitre">{epic.description}</div>
              )}

              {epicEnEdition === epic.id && (
                <>
                  <EditeurFiche
                    champs={CHAMPS_EPIC}
                    valeurs={valeursEpic}
                    onChange={(cle, valeur) => setValeursEpic((v) => ({ ...v, [cle]: valeur }))}
                  />
                  <div className="editeur-fiche__actions">
                    <button
                      className="btn btn--primaire"
                      onClick={() => enregistrerEpic(epic.id, epic.statut, epic.description)}
                      disabled={enregistrementEpic === "en_cours"}
                    >
                      Enregistrer
                    </button>
                    <button className="btn" onClick={() => setEpicEnEdition(null)} disabled={enregistrementEpic === "en_cours"}>
                      Annuler
                    </button>
                    {enregistrementEpic === "erreur" && <span className="champ__erreur">Échec de l'enregistrement</span>}
                  </div>
                </>
              )}

              <div className="liste">
                {epic.tickets.map((t) => (
                  <button className="ligne ligne--cliquable" key={t.id} onClick={() => setTicketSelectionne(t.id)}>
                    <div className="ligne__corps">
                      <span className="badge badge--neutre">{LIBELLES_TYPE_TICKET[t.type] ?? t.type}</span>
                      <span className="ligne__resume">{t.titre}</span>
                      <span className={badgeStatutTicket(t.statut)} style={{ marginLeft: "auto" }}>
                        {t.statut.replace("_", " ")}
                      </span>
                    </div>
                  </button>
                ))}
                {epic.tickets.length === 0 && <div className="etat-vide">Aucun ticket dans cet epic.</div>}
              </div>
            </div>
          ))}

          <div className="constats-groupe">
            <div className="constats-groupe__titre">Suite de recette</div>
            {detail.suite_recette.length === 0 && (
              <div className="etat-vide">Aucun plan de test lié à un ticket de ce projet.</div>
            )}
            {detail.suite_recette.map((plan) => (
              <div className="plan-test" key={plan.id}>
                <div className="plan-test__nom">{plan.nom}</div>
                <div className="liste">
                  {plan.cas.map((c) => (
                    <div className="ligne" key={c.id}>
                      <div className="ligne__corps">
                        <span className={badgeStatutCas(c.statut)}>{c.statut.replace("_", " ")}</span>
                        <span className="ligne__resume">{c.etape}</span>
                        {c.executee_par && (
                          <span className="main__soustitre" style={{ marginLeft: "auto" }}>
                            par {c.executee_par}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
