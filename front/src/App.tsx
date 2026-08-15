import { useEffect, useState } from "react";
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
import { definirNavigation, type Vue } from "./lib/navigation";
import { Aujourdhui } from "./views/Aujourdhui";
import { Journal } from "./views/Journal";
import { Constats } from "./views/Constats";
import { RapportHebdo } from "./views/RapportHebdo";
import { Conversation } from "./views/Conversation";
import { Habilitations } from "./views/Habilitations";
import { ChampsSourceVerite } from "./views/ChampsSourceVerite";
import { Integrations } from "./views/Integrations";
import { Demandes } from "./views/Demandes";
import { Projets } from "./views/Projets";
import { BaseConnaissances } from "./views/BaseConnaissances";
import { PlansTest } from "./views/PlansTest";
import { Agents } from "./views/Agents";
import { EcransMobiles } from "./views/EcransMobiles";
import { Login } from "./views/Login";

function construireGroupes(compteDemandes: number, compteConstats: number, compteProjets: number) {
  return [
    {
      titre: "Pilotage",
      items: [
        { vue: "aujourdhui" as Vue, label: "Aujourd'hui", icone: "◐" },
        { vue: "conversation" as Vue, label: "Conversation", icone: "●" },
        { vue: "demandes" as Vue, label: "Demandes", icone: "▥", compte: compteDemandes },
      ],
    },
    {
      titre: "Mémoire",
      items: [
        { vue: "journal" as Vue, label: "Journal", icone: "☰" },
        { vue: "constats" as Vue, label: "Constats", icone: "▲", compte: compteConstats },
        { vue: "rapport" as Vue, label: "Rapport hebdo", icone: "▤" },
      ],
    },
    {
      titre: "Projets",
      items: [
        { vue: "projets" as Vue, label: "Projets", icone: "▣", compte: compteProjets },
        { vue: "plans_test" as Vue, label: "Plans de test", icone: "☑" },
        { vue: "connaissances" as Vue, label: "Connaissances", icone: "◈" },
      ],
    },
    {
      titre: "Cartographie",
      items: [
        { vue: "habilitations" as Vue, label: "Habilitations", icone: "⊞" },
        { vue: "champs" as Vue, label: "Champs", icone: "≣" },
        { vue: "integrations" as Vue, label: "Intégrations", icone: "⇄" },
      ],
    },
    {
      titre: "Système",
      items: [{ vue: "agents" as Vue, label: "Agents", icone: "✦" }],
    },
    {
      titre: "Mobile",
      items: [{ vue: "mobile" as Vue, label: "Écrans mobiles", icone: "▯" }],
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
        </div>

        <div className="sidebar__recherche">
          <span aria-hidden="true">⌕</span>
          <span>Demander à l'agent</span>
          <span className="sidebar__recherche-raccourci">⌘K</span>
        </div>

        {groupes.map((groupe) => (
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
                  {!!o.compte && <span className="nav__compte">{o.compte}</span>}
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
              onClick={() => {
                seDeconnecter().finally(() => setEtatAuth("deconnecte"));
              }}
            >
              ⏻
            </button>
          )}
        </div>
      </aside>

      <main className={vue === "conversation" ? "main main--conversation" : "main"}>
        {vue === "aujourdhui" && <Aujourdhui />}
        {vue === "conversation" && (
          <Conversation conversationId={conversationActive} onConversationDemarree={setConversationActive} />
        )}
        {vue === "demandes" && <Demandes />}
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
    </div>
  );
}
