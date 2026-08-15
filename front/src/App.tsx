import { useEffect, useState } from "react";
import { recupererConversations, type ConversationResume } from "./lib/api";
import { Journal } from "./views/Journal";
import { Constats } from "./views/Constats";
import { RapportHebdo } from "./views/RapportHebdo";
import { Conversation } from "./views/Conversation";
import { Habilitations } from "./views/Habilitations";
import { ChampsSourceVerite } from "./views/ChampsSourceVerite";
import { Integrations } from "./views/Integrations";
import { Tickets } from "./views/Tickets";

type Vue =
  | "conversation"
  | "tickets"
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
    titre: "Cartographie",
    items: [
      { vue: "habilitations", label: "Habilitations", icone: "⊞" },
      { vue: "champs", label: "Champs", icone: "≣" },
      { vue: "integrations", label: "Intégrations", icone: "⇄" },
    ],
  },
];

export default function App() {
  const [vue, setVue] = useState<Vue>("conversation");
  const [conversations, setConversations] = useState<ConversationResume[]>([]);
  const [conversationActive, setConversationActive] = useState<string | undefined>(undefined);

  useEffect(() => {
    recupererConversations()
      .then((r) => setConversations(r.conversations))
      .catch(() => setConversations([]));
  }, [vue, conversationActive]);

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
      </aside>

      <main className={vue === "conversation" ? "main main--conversation" : "main"}>
        {vue === "conversation" && (
          <Conversation conversationId={conversationActive} onConversationDemarree={setConversationActive} />
        )}
        {vue === "tickets" && <Tickets />}
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
