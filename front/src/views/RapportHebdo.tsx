import { useEffect, useState } from "react";
import { recupererRapportHebdo } from "../lib/api";
import { rendreMarkdownLeger } from "../lib/markdown-lite";

export function RapportHebdo() {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    recupererRapportHebdo()
      .then(setMarkdown)
      .catch((e) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  async function copier() {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopie(true);
    setTimeout(() => setCopie(false), 1600);
  }

  return (
    <div>
      <div className="main__entete">
        <div>
          <h1>Rapport hebdo</h1>
          <div className="main__soustitre">Prêt à envoyer au CEO, tel quel.</div>
        </div>
        <button className="btn" onClick={copier} disabled={!markdown}>
          {copie ? "Copié" : "Copier le markdown"}
        </button>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && markdown === null && <div className="chargement">Chargement…</div>}
      {!erreur && markdown !== null && <div className="rapport">{rendreMarkdownLeger(markdown)}</div>}
    </div>
  );
}
