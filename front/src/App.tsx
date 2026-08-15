import { useEffect, useState } from "react";
import {
  recupererConversations,
  seDeconnecter,
  surSessionExpiree,
  verifierSession,
  type ConversationResume,
} from "./lib/api";
import { Journal } from "./views/Journal";
import { Constats } from "./views/Constats";
import { RapportHebdo } from "./views/RapportHebdo";
import { Conversation } from "./views/Conversation";
import { Habilitations } from "./views/Habilitations";
import { ChampsSourceVerite } from "./views/ChampsSourceVerite";
import { Integrations } from "./views/Integrations";
import { Tickets } from "./views/Tickets";
import { Projets } from "./views/Projets";
import { BaseConnaissances } from "./views/BaseConnaissances";
import { Login } from "./views/Login";

type Vue =
  | "conversation"
  | "tickets"
  | "projets"
  | "connaissances"
  | "journal"
  | "constats"
  | "rapport"
  | "habilitations"
  | "champs"
  | "integrations";

const GROUPES_NAV: { titre: string; items: { vue: Vue; label: string; icone: string }[] }[] = [
  {
    titre: "Registre",
    items: [
      { vue: "conversation", label: "Conversation", icone: "●" },
      { vue: "tickets", label: "Tickets", icone: "▥" },
      { vue: "journal", label: "Journal", icone: "☰" },
      { vue: "constats", label: "Constats", icone: "▲" },
      { vue: "rapport", label: "Rapport hebdo", icone: "▤" },
    ],
  },
  {
    titre: "Projets",
    items: [
      { vue: "projets", label: "Projets", icone: "▣" },
      { vue: "connaissances", label: "Base de connaissances", icone: "◈" },
    ],
  },
  {
    titre: "Cartographie",
    items: [
      { vue: "habilitations", label: "Habilitations", icone: "⊞" },
      { vue: "champs", label: "Champs", icone: "≣" },
      { vue: "integrations", label: "Intégrations", icone: "⇄" },
    ],
  },
];

type EtatAuth = "chargement" | "connecte" | "deconnecte";

export default function App() {
  const [etatAuth, setEtatAuth] = useState<EtatAuth>("chargement");
  const [verrouille, setVerrouille] = useState(false);
  const [vue, setVue] = useState<Vue>("conversation");
  const [conversations, setConversations] = useState<ConversationResume[]>([]);
  const [conversationActive, setConversationActive] = useState<string | undefined>(undefined);

  useEffect(() => {
    surSessionExpiree(() => setEtatAuth("deconnecte"));
    verifierSession()
      .then((s) => {
        setVerrouille(s.verrouille);
        setEtatAuth(s.authentifie ? "connecte" : "deconnecte");
      })
      .catch(() => setEtatAuth("deconnecte"));
  }, []);

  useEffect(() => {
    if (etatAuth !== "connecte") return;
    recupererConversations()
      .then((r) => setConversations(r.conversations))
      .catch(() => setConversations([]));
  }, [vue, conversationActive, etatAuth]);

  if (etatAuth === "chargement") return <div className="page-chargement">Chargement…</div>;
  if (etatAuth === "deconnecte") return <Login onConnecte={() => setEtatAuth("connecte")} />;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__titre">
          <span className="sidebar__nom">Registre SI</span>
          <span className="sidebar__baseline">Abraxio</span>
        </div>

        {GROUPES_NAV.map((groupe) => (
          <div className="nav-groupe" key={groupe.titre}>
            <div className="nav-groupe__titre">{groupe.titre}</div>
            <nav className="nav">
              {groupe.items.map((o) => (
                <button
                  key={o.vue}
                  className={`nav__item${vue === o.vue ? " nav__item--actif" : ""}`}
                  onClick={() => setVue(o.vue)}
                >
                  <span className="nav__icone">{o.icone}</span>
                  {o.label}
                </button>
              ))}
            </nav>
          </div>
        ))}

        <div className="sidebar__section">
          <div className="sidebar__section-titre">
            <span>Conversations récentes</span>
            <button
              className="sidebar__nouvelle"
              title="Nouvelle conversation"
              onClick={() => {
                setConversationActive(undefined);
                setVue("conversation");
              }}
            >
              + Nouvelle
            </button>
          </div>
          <div className="conversations-recentes">
            {conversations.length === 0 && <div className="etat-vide">Aucune conversation.</div>}
            {conversations.map((c) => (
              <button
                key={c.id}
                className={`conversation-recente${c.id === conversationActive ? " conversation-recente--active" : ""}`}
                onClick={() => {
                  setConversationActive(c.id);
                  setVue("conversation");
                }}
                title={c.titre ?? c.id}
              >
                {c.titre ?? "(sans titre)"}
              </button>
            ))}
          </div>
        </div>

        {verrouille && (
          <button
            className="sidebar__deconnexion"
            onClick={() => {
              seDeconnecter().finally(() => setEtatAuth("deconnecte"));
            }}
          >
            Se déconnecter
          </button>
        )}
      </aside>

      <main className={vue === "conversation" ? "main main--conversation" : "main"}>
        {vue === "conversation" && (
          <Conversation conversationId={conversationActive} onConversationDemarree={setConversationActive} />
        )}
        {vue === "tickets" && <Tickets />}
        {vue === "projets" && <Projets />}
        {vue === "connaissances" && <BaseConnaissances />}
        {vue === "journal" && <Journal />}
        {vue === "constats" && <Constats />}
        {vue === "rapport" && <RapportHebdo />}
        {vue === "habilitations" && <Habilitations />}
        {vue === "champs" && <ChampsSourceVerite />}
        {vue === "integrations" && <Integrations />}
      </main>
    </div>
  );
}
