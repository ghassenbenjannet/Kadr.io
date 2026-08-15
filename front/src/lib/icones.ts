// Correspondance UNIQUE icône ↔ vue de navigation / nature d'entité du
// journal, réutilisée partout où cette vue ou cette entité apparaît (nav,
// tableaux, fiches détail, rapport, états vides). lucide-react uniquement —
// jamais d'emoji, jamais un glyphe Unicode improvisé au point d'usage.

import {
  LayoutDashboard,
  MessageSquare,
  KanbanSquare,
  ScrollText,
  AlertTriangle,
  FileBarChart2,
  FolderKanban,
  ClipboardCheck,
  Library,
  ShieldCheck,
  Rows3,
  ArrowLeftRight,
  Bot,
  Smartphone,
  Inbox,
  Scale,
  Repeat2,
  AlertOctagon,
  type LucideIcon,
} from "lucide-react";
import type { Vue } from "./navigation";

export const ICONES_NAV: Record<Vue, LucideIcon> = {
  aujourdhui: LayoutDashboard,
  conversation: MessageSquare,
  kanban: KanbanSquare,
  journal: ScrollText,
  constats: AlertTriangle,
  rapport: FileBarChart2,
  projets: FolderKanban,
  plans_test: ClipboardCheck,
  connaissances: Library,
  habilitations: ShieldCheck,
  champs: Rows3,
  integrations: ArrowLeftRight,
  agents: Bot,
  mobile: Smartphone,
};

export const ICONES_ENTITE: Record<string, LucideIcon> = {
  demande: Inbox,
  decision: Scale,
  changement: Repeat2,
  incident: AlertOctagon,
};

export function iconeEntite(entite: string): LucideIcon {
  return ICONES_ENTITE[entite] ?? ScrollText;
}
