import { useEffect, useState } from "react";
import { Search, LogOut } from "lucide-react";
import {
  recupererConversations,
  recupererDemandes,
  recupererConstats,
  recupererProjets,
  seDeconnecter,
  surSessionExpiree,
  verifierSession,
  type ConversationResume,
} from "./lib/api";
import { definirNavigation, LIBELLES_VUE, type Vue } from "./lib/navigation";
import { ICONES_NAV } from "./lib/icones";
import { Aujourdhui } from "./views/Aujourdhui";
import { Journal } from "./views/Journal";
import { Constats } from "./views/Constats";
import { RapportHebdo } from "./views/RapportHebdo";
import { Conversation } from "./views/Conversation";
import { Habilitations } from "./views/Habilitations";
import { ChampsSourceVerite } from "./views/ChampsSourceVerite";
import { Integrations } from "./views/Integrations";
import { Kanban } from "./views/Kanban";
import { Projets } from "./views/Projets";
import { BaseConnaissances } from "./views/BaseConnaissances";
import { PlansTest } from "./views/PlansTest";
import { Agents } from "./views/Agents";
import { EcransMobiles } from "./views/EcransMobiles";
import { Login } from "./views/Login";
import { ThemeSelector } from "./components/ThemeSelector";
import { ToastHost } from "./components/ToastHost";

function construireGroupes(compteDemandes: number, compteConstats: number, compteProjets: number) {
  return [
    {
      titre: "Pilotage",
      items: [
        { vue: "aujourdhui" as Vue },
        { vue: "conversation" as Vue },
        { vue: "kanban" as Vue, compte: compteDemandes },
      ],
    },
    {
      titre: "Mémoire",
      items: [
        { vue: "journal" as Vue },
        { vue: "constats" as Vue, compte: compteConstats },
        { vue: "rapport" as Vue },
      ],
    },
    {
      titre: "Projets",
      items: [
        { vue: "projets" as Vue, compte: compteProjets },
        { vue: "plans_test" as Vue },
        { vue: "connaissances" as Vue },
      ],
    },
    {
      titre: "Cartographie",
      items: [{ vue: "habilitations" as Vue }, { vue: "champs" as Vue }, { vue: "integrations" as Vue }],
    },
    {
      titre: "Système",
      items: [{ vue: "agents" as Vue }],
    },
    {
      titre: "Mobile",
      items: [{ vue: "mobile" as Vue }],
    },
  ];
}

type EtatAuth = "chargement" | "connecte" | "deconnecte";

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const OPERATEUR = "Ghassen B.";

export default function App() {
  const [etatAuth, setEtatAuth] = useState<EtatAuth>("chargement");
  const [verrouille, setVerrouille] = useState(false);
  const [vue, setVue] = useState<Vue>("aujourdhui");
  const [conversations, setConversations] = useState<ConversationResume[]>([]);
  const [conversationActive, setConversationActive] = useState<string | undefined>(undefined);
  const [compteDemandes, setCompteDemandes] = useState(0);
  const [compteConstats, setCompteConstats] = useState(0);
  const [compteProjets, setCompteProjets] = useState(0);

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
    definirNavigation(setVue);
  }, []);

  useEffect(() => {
    document.title = `${LIBELLES_VUE[vue]} — Registre SI`;
  }, [vue]);

  useEffect(() => {
    if (etatAuth !== "connecte") return;
    recupererConversations()
      .then((r) => setConversations(r.conversations))
      .catch(() => setConversations([]));
    recupererDemandes()
      .then((r) => setCompteDemandes(r.demandes.length))
      .catch(() => {});
    recupererConstats()
      .then((r) => setCompteConstats(r.ok ? r.constats.length : 0))
      .catch(() => {});
    recupererProjets()
      .then((r) => setCompteProjets(r.projets.length))
      .catch(() => {});
  }, [vue, conversationActive, etatAuth]);

  if (etatAuth === "chargement") return <div className="page-chargement">Chargement…</div>;
  if (etatAuth === "deconnecte") return <Login onConnecte={() => setEtatAuth("connecte")} />;

  const groupes = construireGroupes(compteDemandes, compteConstats, compteProjets);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__titre">
          <div className="sidebar__logo">◆</div>
          <div className="sidebar__identite">
            <span className="sidebar__nom">Registre SI</span>
            <span className="sidebar__baseline">Abraxio</span>
          </div>
          <ThemeSelector />
        </div>

        <div className="sidebar__recherche">
          <Search size={14} aria-hidden="true" />
          <span>Demander à l'agent</span>
          <kbd className="sidebar__recherche-raccourci">⌘K</kbd>
        </div>

        {groupes.map((groupe) => (
          <div className="nav-groupe" key={groupe.titre}>
            <div className="nav-groupe__titre">{groupe.titre}</div>
            <nav className="nav">
              {groupe.items.map((o) => {
                const Icone = ICONES_NAV[o.vue];
                return (
                  <button
                    key={o.vue}
                    className={`nav__item${vue === o.vue ? " nav__item--actif" : ""}`}
                    onClick={() => setVue(o.vue)}
                  >
                    <Icone size={18} className="nav__icone" aria-hidden="true" />
                    {LIBELLES_VUE[o.vue]}
                    {!!o.compte && <span className="nav__compte">{o.compte}</span>}
                  </button>
                );
              })}
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

        <div className="sidebar__pied">
          <div className="sidebar__avatar">{initiales(OPERATEUR)}</div>
          <div className="sidebar__identite-pied">
            <span className="sidebar__nom-pied">{OPERATEUR}</span>
            <span className="sidebar__role-pied">Opérateur SI</span>
          </div>
          {verrouille && (
            <button
              className="sidebar__deconnexion"
              title="Se déconnecter"
              aria-label="Se déconnecter"
              onClick={() => {
                seDeconnecter().finally(() => setEtatAuth("deconnecte"));
              }}
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>

      <main className={vue === "conversation" ? "main main--conversation" : "main"}>
        {vue === "aujourdhui" && <Aujourdhui />}
        {vue === "conversation" && (
          <Conversation conversationId={conversationActive} onConversationDemarree={setConversationActive} />
        )}
        {vue === "kanban" && <Kanban />}
        {vue === "projets" && <Projets />}
        {vue === "connaissances" && <BaseConnaissances />}
        {vue === "journal" && <Journal />}
        {vue === "constats" && <Constats />}
        {vue === "rapport" && <RapportHebdo />}
        {vue === "plans_test" && <PlansTest />}
        {vue === "habilitations" && <Habilitations />}
        {vue === "champs" && <ChampsSourceVerite />}
        {vue === "integrations" && <Integrations />}
        {vue === "agents" && <Agents />}
        {vue === "mobile" && <EcransMobiles />}
      </main>
      <ToastHost />
    </div>
  );
}
