import { useEffect, useState } from "react";
import { recupererRapportHebdo } from "../lib/api";
import { rendreMarkdownLeger } from "../lib/markdown-lite";
import { PageHeader } from "../components/PageHeader";

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
      <PageHeader icone="▤" titre="Rapport hebdo" sousTitre="Prêt à envoyer au CEO, tel quel.">
        <button className="btn" onClick={copier} disabled={!markdown}>
          {copie ? "Copié" : "Copier le markdown"}
        </button>
      </PageHeader>

      {erreur && <div className="erreur">{erreur}</div>}
      {!erreur && markdown === null && <div className="chargement">Chargement…</div>}
      {!erreur && markdown !== null && <div className="rapport">{rendreMarkdownLeger(markdown)}</div>}
    </div>
  );
}
