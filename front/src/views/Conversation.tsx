import { useEffect, useRef, useState } from "react";
import { envoyerMessage, recupererConversation, type EcritureProposee, type ResultatConfirm } from "../lib/api";
import { libelleOutil } from "../lib/outils-libelles";
import { ValidationCard } from "../components/ValidationCard";

let compteurId = 0;
function idLocal(): string {
  compteurId += 1;
  return `local-${compteurId}`;
}

type ElementFil =
  | { type: "user"; id: string; texte: string }
  | { type: "assistant"; id: string; texte: string }
  | { type: "trace"; id: string; outil: string; phase: "debut" | "fin"; resume?: string }
  | { type: "validation"; id: string; ecriture: EcritureProposee }
  | { type: "validation_resolue"; id: string; outil: string; statut: EcritureProposee["statut"] };

interface Props {
  conversationId: string | undefined;
  onConversationDemarree: (id: string) => void;
}

export function Conversation({ conversationId, onConversationDemarree }: Props) {
  const [elements, setElements] = useState<ElementFil[]>([]);
  const [entree, setEntree] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [ecritureActive, setEcritureActive] = useState<EcritureProposee | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const idConversationRef = useRef(conversationId);
  // Id de la conversation déjà représentée dans `elements` (soit rechargée
  // depuis le serveur, soit construite en direct par le streaming). Évite de
  // re-fetcher et d'écraser le fil qu'on vient tout juste de construire
  // localement quand App.tsx nous renvoie le même id en prop après coup.
  const idChargeRef = useRef<string | undefined>(undefined);
  const finRef = useRef<HTMLDivElement>(null);

  function defiler() {
    requestAnimationFrame(() => finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  // Changement de conversation (clic dans la barre latérale) : on recharge
  // l'historique. Par simplicité, seuls les blocs texte sont rejoués — un
  // outil resté en attente de validation avant un rechargement de page
  // n'est pas ré-affiché (limite connue, hors des scénarios testés au §8).
  useEffect(() => {
    idConversationRef.current = conversationId;
    if (conversationId === idChargeRef.current) return;
    idChargeRef.current = conversationId;
    setEcritureActive(null);
    setErreur(null);
    if (!conversationId) {
      setElements([]);
      return;
    }
    let annule = false;
    recupererConversation(conversationId)
      .then((r) => {
        if (annule) return;
        const rejoues: ElementFil[] = [];
        for (const m of r.messages) {
          if (m.role === "tool_result") continue;
          const texte = m.contenu
            .filter((b): b is { type: "text"; text: string } => b.type === "text")
            .map((b) => b.text)
            .join("\n");
          if (texte) rejoues.push({ type: m.role === "user" ? "user" : "assistant", id: idLocal(), texte });
        }
        setElements(rejoues);
        defiler();
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
    return () => {
      annule = true;
    };
  }, [conversationId]);

  function ajouterTexte(delta: string) {
    setElements((els) => {
      const dernier = els[els.length - 1];
      if (dernier && dernier.type === "assistant") {
        const copie = els.slice(0, -1);
        return [...copie, { ...dernier, texte: dernier.texte + delta }];
      }
      return [...els, { type: "assistant", id: idLocal(), texte: delta }];
    });
    defiler();
  }

  function marquerTraceTerminee(outil: string, resume?: string) {
    setElements((els) => {
      const index = [...els].reverse().findIndex((e) => e.type === "trace" && e.outil === outil && e.phase === "debut");
      if (index === -1) return els;
      const i = els.length - 1 - index;
      const copie = [...els];
      copie[i] = { ...(copie[i] as Extract<ElementFil, { type: "trace" }>), phase: "fin", resume };
      return copie;
    });
  }

  async function envoyer() {
    const message = entree.trim();
    if (!message || enCours) return;
    setEntree("");
    setErreur(null);
    setElements((els) => [...els, { type: "user", id: idLocal(), texte: message }]);
    setEnCours(true);
    defiler();

    await envoyerMessage(
      { conversationId: idConversationRef.current, message },
      {
        onTexte: ajouterTexte,
        onOutilLecture: ({ outil, phase, resume }) => {
          if (phase === "debut") {
            setElements((els) => [...els, { type: "trace", id: idLocal(), outil, phase: "debut" }]);
            defiler();
          } else {
            marquerTraceTerminee(outil, resume);
          }
        },
        onValidationRequise: (ecriture) => {
          setElements((els) => [...els, { type: "validation", id: idLocal(), ecriture }]);
          setEcritureActive(ecriture);
          defiler();
        },
        onFin: (resultat) => {
          if (!idConversationRef.current) {
            idConversationRef.current = resultat.conversationId;
            idChargeRef.current = resultat.conversationId;
            onConversationDemarree(resultat.conversationId);
          }
          setEnCours(false);
        },
        onErreur: (msg) => {
          setErreur(msg);
          setEnCours(false);
        },
      }
    );
  }

  function surEcritureTranchee(idElement: string, action: "valider" | "rejeter", resultat: ResultatConfirm) {
    setElements((els) => {
      const copie = els.map((e): ElementFil =>
        e.id === idElement && e.type === "validation"
          ? { type: "validation_resolue", id: e.id, outil: e.ecriture.outil, statut: action === "valider" ? "validee" : "rejetee" }
          : e
      );
      if (resultat.texteAssistant) {
        copie.push({ type: "assistant", id: idLocal(), texte: resultat.texteAssistant });
      }
      if (resultat.ecriture) {
        copie.push({ type: "validation", id: idLocal(), ecriture: resultat.ecriture });
      }
      return copie;
    });
    setEcritureActive(resultat.ecriture ?? null);
    defiler();
  }

  return (
    <div className="conversation">
      <div className="conversation__fil">
        {elements.length === 0 && (
          <div className="etat-vide">
            Écris ce que tu veux enregistrer ou demander — par exemple : « Sophie du CS veut voir les factures dans
            la fiche client ».
          </div>
        )}
        {elements.map((e) => {
          if (e.type === "user") {
            return (
              <div className="bulle bulle--utilisateur" key={e.id}>
                {e.texte}
              </div>
            );
          }
          if (e.type === "assistant") {
            return (
              <div className="bulle bulle--assistant" key={e.id}>
                {e.texte}
              </div>
            );
          }
          if (e.type === "trace") {
            return (
              <div className="trace mono" key={e.id}>
                {e.phase === "debut" ? `${libelleOutil(e.outil).toLowerCase()}…` : e.resume ?? "terminé"}
              </div>
            );
          }
          if (e.type === "validation") {
            return (
              <ValidationCard
                key={e.id}
                ecriture={e.ecriture}
                onTranchee={(action, resultat) => surEcritureTranchee(e.id, action, resultat)}
              />
            );
          }
          return (
            <div className="trace mono trace--resolue" key={e.id}>
              {libelleOutil(e.outil)} — {e.statut === "rejetee" ? "rejeté" : "enregistré"}
            </div>
          );
        })}
        {enCours && elements[elements.length - 1]?.type === "user" && (
          <div className="trace mono trace--attente">réflexion…</div>
        )}
        <div ref={finRef} />
      </div>

      {erreur && <div className="erreur conversation__erreur">{erreur}</div>}

      <form
        className="conversation__saisie"
        onSubmit={(ev) => {
          ev.preventDefault();
          envoyer();
        }}
      >
        <textarea
          value={entree}
          onChange={(e) => setEntree(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              envoyer();
            }
          }}
          placeholder={ecritureActive ? "Tranche la proposition ci-dessus avant de continuer…" : "Écris ici…"}
          disabled={enCours || ecritureActive !== null}
          rows={2}
        />
        <button className="btn btn--primaire" type="submit" disabled={enCours || ecritureActive !== null || !entree.trim()}>
          Envoyer
        </button>
      </form>
    </div>
  );
}
