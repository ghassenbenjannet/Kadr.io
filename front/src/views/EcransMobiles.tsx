import { PageHeader } from "../components/PageHeader";
import { ActionsGlobales } from "../components/ActionsGlobales";

/** Galerie décorative — référence visuelle du rendu mobile, sans logique propre. */
export function EcransMobiles() {
  return (
    <div>
      <PageHeader vue="mobile" groupe="Mobile" titre="Écrans mobiles">
        <ActionsGlobales />
      </PageHeader>

      <div className="telephones-galerie">
        <div className="telephone">
          <div className="telephone__barre">
            <span>9:41</span>
            <span>▮▮▮</span>
          </div>
          <div className="telephone__ecran">
            <div className="telephone__entete">
              <div className="sidebar__logo" style={{ width: 24, height: 24, fontSize: "0.75rem" }}>
                ◆
              </div>
              Conversation
            </div>
            <div className="telephone__corps">
              <div className="bulle bulle--utilisateur" style={{ maxWidth: "100%" }}>
                Sophie veut voir les factures dans la fiche client.
              </div>
              <div className="editeur-fiche" style={{ margin: 0 }}>
                <span className="badge badge--demande">Écriture proposée</span>
                <strong>Enregistrer une demande</strong>
                <div className="editeur-fiche__actions">
                  <button className="btn btn--primaire" disabled>
                    Enregistrer
                  </button>
                  <button className="btn btn--danger" disabled>
                    Rejeter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="telephone">
          <div className="telephone__barre">
            <span>9:41</span>
            <span>▮▮▮</span>
          </div>
          <div className="telephone__ecran">
            <div className="telephone__entete">Demandes</div>
            <div className="telephone__corps">
              <div className="pilules">
                <span className="pilule pilule--actif">Reçue · 3</span>
                <span className="pilule">Qualifiée · 2</span>
              </div>
              <div className="carte-demande">
                <span className="badge badge--neutre">CS</span>
                <div className="carte-demande__expression">Sophie veut voir les factures dans la fiche client.</div>
              </div>
              <div className="carte-demande">
                <span className="badge badge--neutre">ADV</span>
                <div className="carte-demande__expression">Exporter les lignes de commande au format CSV.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
