import { useEffect, useState } from "react";
import {
  recupererAgents,
  recupererAgent,
  creerAgentDirect,
  mettreAJourAgentDirect,
  supprimerAgentDirect,
  type AgentMode,
} from "../lib/api";
import { rendreMarkdownLeger } from "../lib/markdown-lite";
import { PageHeader } from "../components/PageHeader";

function AgentEditeur({ id, onRetour, onSupprime }: { id: string; onRetour: () => void; onSupprime: () => void }) {
  const [agent, setAgent] = useState<AgentMode | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cle, setCle] = useState("");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [contenu, setContenu] = useState("");
  const [mode, setMode] = useState<"edition" | "apercu">("edition");
  const [statut, setStatut] = useState<"inactif" | "en_cours" | "enregistre" | "erreur">("inactif");

  useEffect(() => {
    let annule = false;
    recupererAgent(id)
      .then((r) => {
        if (annule) return;
        setAgent(r);
        setCle(r.cle);
        setTitre(r.titre);
        setDescription(r.description ?? "");
        setContenu(r.contenu);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      });
    return () => {
      annule = true;
    };
  }, [id]);

  const modifie =
    agent !== null &&
    (cle !== agent.cle || titre !== agent.titre || description !== (agent.description ?? "") || contenu !== agent.contenu);

  async function enregistrer() {
    setStatut("en_cours");
    try {
      await mettreAJourAgentDirect(id, { cle, titre, description, contenu });
      setAgent((a) => (a ? { ...a, cle, titre, description, contenu } : a));
      setStatut("enregistre");
      setTimeout(() => setStatut("inactif"), 1600);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setStatut("erreur");
    }
  }

  async function supprimer() {
    if (!agent) return;
    if (!confirm(`Supprimer l'agent « ${agent.titre} » ? Cette action est irréversible.`)) return;
    try {
      await supprimerAgentDirect(id);
      onSupprime();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <button className="lien-retour" onClick={onRetour}>
        ← Agents
      </button>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && agent === null && <div className="chargement">Chargement…</div>}

      {!erreur && agent !== null && (
        <>
          <div className="editeur__entete">
            <input
              className="editeur__titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              aria-label="Titre de l'agent"
            />
            <button className="btn btn--danger" onClick={supprimer}>
              Supprimer
            </button>
          </div>

          <div className="editeur-fiche" style={{ marginBottom: "var(--e-3)" }}>
            <div className="champ">
              <label className="champ__label" htmlFor="agent-cle">
                Clé (utilisée par l'agent pour charger ce mode)
              </label>
              <input id="agent-cle" className="mono" value={cle} onChange={(e) => setCle(e.target.value)} />
            </div>
            <div className="champ">
              <label className="champ__label" htmlFor="agent-description">
                Description courte
              </label>
              <input
                id="agent-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="À quoi sert ce mode, en une phrase"
              />
            </div>
          </div>

          <div className="editeur__barre">
            <div className="editeur__onglets">
              <button
                className={`editeur__onglet${mode === "edition" ? " editeur__onglet--actif" : ""}`}
                onClick={() => setMode("edition")}
              >
                Instructions
              </button>
              <button
                className={`editeur__onglet${mode === "apercu" ? " editeur__onglet--actif" : ""}`}
                onClick={() => setMode("apercu")}
              >
                Aperçu
              </button>
            </div>
            <div className="editeur__actions">
              <span className="editeur__statut">
                {statut === "enregistre" && "Enregistré"}
                {statut === "erreur" && "Échec de l'enregistrement"}
                {statut === "inactif" && modifie && "Modifications non enregistrées"}
              </span>
              <button className="btn btn--primaire" onClick={enregistrer} disabled={!modifie || statut === "en_cours"}>
                Enregistrer
              </button>
            </div>
          </div>

          {mode === "edition" ? (
            <textarea
              className="editeur__zone"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <div className="rapport editeur__apercu">{rendreMarkdownLeger(contenu)}</div>
          )}
        </>
      )}
    </div>
  );
}

export function Agents() {
  const [agents, setAgents] = useState<AgentMode[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouveauCle, setNouveauCle] = useState("");
  const [nouveauTitre, setNouveauTitre] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);

  function charger() {
    setErreur(null);
    return recupererAgents()
      .then((r) => setAgents(r.agents))
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    charger();
  }, []);

  async function creer() {
    if (!nouveauCle.trim() || !nouveauTitre.trim()) {
      setErreurCreation("La clé et le titre sont requis.");
      return;
    }
    setCreationEnCours(true);
    setErreurCreation(null);
    try {
      const r = await creerAgentDirect({
        cle: nouveauCle.trim(),
        titre: nouveauTitre.trim(),
        contenu: `# Mode : ${nouveauTitre.trim()}\n\nDécris ici les instructions détaillées de ce mode.`,
      });
      setCreationOuverte(false);
      setNouveauCle("");
      setNouveauTitre("");
      setSelection(r.id);
    } catch (e) {
      setErreurCreation(e instanceof Error ? e.message : String(e));
    } finally {
      setCreationEnCours(false);
    }
  }

  if (selection) {
    return (
      <AgentEditeur
        id={selection}
        onRetour={() => {
          setSelection(null);
          charger();
        }}
        onSupprime={() => {
          setSelection(null);
          charger();
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader groupe="Système" titre="Agents">
        <button className="btn btn--primaire" onClick={() => setCreationOuverte((v) => !v)}>
          {creationOuverte ? "Fermer" : "+ Nouvel agent"}
        </button>
      </PageHeader>

      <p className="main__soustitre" style={{ marginTop: 0 }}>
        Modes de travail spécialisés que l'agent charge lui-même via <code className="mono">charger_mode</code>{" "}
        selon la demande — analyse, architecture, revue SI… Personnalise leurs instructions, ou ajoute-en de
        nouveaux.
      </p>

      {creationOuverte && (
        <div className="editeur-fiche">
          <div className="champ">
            <label className="champ__label" htmlFor="nouvel-agent-cle">
              Clé
            </label>
            <input
              id="nouvel-agent-cle"
              className="mono"
              value={nouveauCle}
              onChange={(e) => setNouveauCle(e.target.value)}
              placeholder="ex : audit_secu"
            />
          </div>
          <div className="champ">
            <label className="champ__label" htmlFor="nouvel-agent-titre">
              Titre
            </label>
            <input
              id="nouvel-agent-titre"
              value={nouveauTitre}
              onChange={(e) => setNouveauTitre(e.target.value)}
              placeholder="ex : Audit sécurité"
            />
          </div>
          {erreurCreation && <div className="champ__erreur">{erreurCreation}</div>}
          <div className="editeur-fiche__actions">
            <button className="btn btn--primaire" onClick={creer} disabled={creationEnCours}>
              Créer
            </button>
            <button className="btn" onClick={() => setCreationOuverte(false)} disabled={creationEnCours}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && agents === null && <div className="chargement">Chargement…</div>}
      {!erreur && agents !== null && agents.length === 0 && !creationOuverte && (
        <div className="etat-vide">Aucun agent pour l'instant.</div>
      )}
      {!erreur && agents !== null && agents.length > 0 && (
        <div className="liste">
          {agents.map((a) => (
            <button className="ligne ligne--cliquable" key={a.id} onClick={() => setSelection(a.id)}>
              <div className="ligne__corps">
                <span className="badge badge--neutre mono">{a.cle}</span>
                <span className="ligne__resume">{a.titre}</span>
                {a.description && (
                  <span className="main__soustitre" style={{ marginLeft: "auto" }}>
                    {a.description}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
