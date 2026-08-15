import { useEffect, useState } from "react";
import { recupererConversations, type ConversationResume } from "./lib/api";
import { Journal } from "./views/Journal";
import { Constats } from "./views/Constats";
import { RapportHebdo } from "./views/RapportHebdo";

type Vue = "conversation" | "journal" | "constats" | "rapport";

const ONGLETS: { vue: Vue; label: string; icone: string }[] = [
  { vue: "conversation", label: "Conversation", icone: "●" },
  { vue: "journal", label: "Journal", icone: "☰" },
  { vue: "constats", label: "Constats", icone: "▲" },
  { vue: "rapport", label: "Rapport hebdo", icone: "▤" },
];

function ConversationPlaceholder() {
  return (
    <div>
      <div className="main__entete">
        <div>
          <h1>Conversation</h1>
          <div className="main__soustitre">Arrive à l'étape suivante (streaming + carte de validation).</div>
        </div>
      </div>
      <div className="etat-vide">
        En attendant, les vues Journal, Constats et Rapport hebdo sont disponibles dans la barre latérale.
      </div>
    </div>
  );
}

export default function App() {
  const [vue, setVue] = useState<Vue>("conversation");
  const [conversations, setConversations] = useState<ConversationResume[]>([]);

  useEffect(() => {
    recupererConversations()
      .then((r) => setConversations(r.conversations))
      .catch(() => setConversations([]));
  }, [vue]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__titre">
          <span className="sidebar__nom">Registre SI</span>
          <span className="sidebar__baseline">Abraxio</span>
        </div>

        <nav className="nav">
          {ONGLETS.map((o) => (
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

        <div className="sidebar__section">
          <div className="sidebar__section-titre">Conversations récentes</div>
          <div className="conversations-recentes">
            {conversations.length === 0 && <div className="etat-vide">Aucune conversation.</div>}
            {conversations.map((c) => (
              <button
                key={c.id}
                className="conversation-recente"
                onClick={() => setVue("conversation")}
                title={c.titre ?? c.id}
              >
                {c.titre ?? "(sans titre)"}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="main">
        {vue === "conversation" && <ConversationPlaceholder />}
        {vue === "journal" && <Journal />}
        {vue === "constats" && <Constats />}
        {vue === "rapport" && <RapportHebdo />}
      </main>
    </div>
  );
}
