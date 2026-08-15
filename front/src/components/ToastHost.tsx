import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { definirGestionnaireToast, type Toast, type NatureToast } from "../lib/toast";

const DUREE_MS = 4000;

const ICONES: Record<NatureToast, typeof CheckCircle2> = {
  succes: CheckCircle2,
  erreur: AlertCircle,
  info: Info,
};

/** Monté une fois dans App.tsx : empile les toasts déclenchés via lib/toast.ts, auto-disparition après 4s. */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function retirer(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  useEffect(() => {
    definirGestionnaireToast((toast) => {
      setToasts((t) => [...t, toast]);
      setTimeout(() => retirer(toast.id), DUREE_MS);
    });
    return () => definirGestionnaireToast(null);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icone = ICONES[toast.nature];
        return (
          <div className={`toast toast--${toast.nature}`} key={toast.id}>
            <Icone size={16} aria-hidden="true" />
            <span>{toast.message}</span>
            <button className="toast__fermer" aria-label="Fermer" onClick={() => retirer(toast.id)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
