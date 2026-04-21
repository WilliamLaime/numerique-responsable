import { useAuditStore } from '../../store/auditStore';
import { useSettings } from '../../hooks/useSettings';
import { useStorage } from '../../hooks/useStorage';
import { useModal } from '../../contexts/ModalContext';
import type { AuditMode, SavedAuditEntry } from '../../types/audit';

interface Props {
  active: boolean;
  startAudit: (mode: AuditMode) => Promise<void>;
}

export default function SelectScreen({ active, startAudit }: Props) {
  const selectTab = useAuditStore((s) => s.selectTab);
  const setSelectTab = useAuditStore((s) => s.setSelectTab);
  const scope = useAuditStore((s) => s.scope);
  const setScope = useAuditStore((s) => s.setScope);
  const pageLimit = useAuditStore((s) => s.pageLimit);
  const setPageLimit = useAuditStore((s) => s.setPageLimit);
  const savedAudits = useAuditStore((s) => s.savedAudits);
  const loadSavedAudit = useAuditStore((s) => s.loadSavedAudit);

  const { concurrency, settleDelay, updateConcurrency, updateSettleDelay } = useSettings();
  const { deleteAudit, renameAudit } = useStorage();
  const { nrConfirm, nrPrompt } = useModal();

  const handleRename = async (id: string, currentName: string) => {
    const newName = await nrPrompt('Nouveau nom :', currentName);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName) return;
    await renameAudit(id, trimmed);
  };

  const handleDelete = async (entry: SavedAuditEntry) => {
    if (!(await nrConfirm(`Supprimer l'audit "${entry.name}" ?`))) return;
    await deleteAudit(entry.id);
  };

  return (
    <section id="screen-select" className={`screen${active ? ' active' : ''}`}>
      <div className="select-tabs" role="tablist">
        <button
          className={`select-tab${selectTab === 'new' ? ' active' : ''}`}
          data-panel="new"
          role="tab"
          aria-selected={selectTab === 'new' ? 'true' : 'false'}
          aria-controls="panel-new"
          onClick={() => setSelectTab('new')}
        >
          Nouvel audit
        </button>
        <button
          className={`select-tab${selectTab === 'saved' ? ' active' : ''}`}
          data-panel="saved"
          role="tab"
          aria-selected={selectTab === 'saved' ? 'true' : 'false'}
          aria-controls="panel-saved"
          onClick={() => setSelectTab('saved')}
        >
          Mes audits{' '}
          {savedAudits.length > 0 && (
            <span id="saved-count" className="tab-badge">{savedAudits.length}</span>
          )}
        </button>
      </div>

      <div
        id="panel-new"
        className={`select-panel${selectTab === 'new' ? ' active' : ''}`}
        role="tabpanel"
        aria-labelledby="tab-new"
        hidden={selectTab !== 'new'}
      >
        <div className="field">
          <label className="field-label">Périmètre</label>
          <div className="scope-options">
            <label className="scope-option">
              <input
                type="radio"
                name="scope"
                value="site"
                checked={scope === 'site'}
                onChange={() => setScope('site')}
              />
              <span>
                <strong>Site complet</strong>
                <em>Crawle plusieurs pages via sitemap.xml + liens internes</em>
              </span>
            </label>
            <label className="scope-option">
              <input
                type="radio"
                name="scope"
                value="page"
                checked={scope === 'page'}
                onChange={() => setScope('page')}
              />
              <span>
                <strong>Page courante uniquement</strong>
                <em>Audit rapide de l'onglet actif</em>
              </span>
            </label>
          </div>
        </div>

        {scope === 'site' && (
          <div className="field" id="crawl-options">
            <label className="field-label" htmlFor="page-limit">Nombre max de pages</label>
            <select
              id="page-limit"
              value={String(pageLimit)}
              onChange={(e) =>
                setPageLimit(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
              }
            >
              <option value="all">Toutes les pages du site</option>
              <option value="5">5 pages</option>
              <option value="10">10 pages</option>
              <option value="25">25 pages</option>
              <option value="50">50 pages</option>
            </select>
          </div>
        )}

        <details className="field advanced-settings">
          <summary>Réglages avancés</summary>
          <div className="advanced-grid">
            <label className="advanced-item">
              <span className="field-label">Pages en parallèle</span>
              <input
                type="number"
                id="opt-concurrency"
                min="1"
                max="8"
                step="1"
                value={concurrency}
                onChange={(e) => updateConcurrency(e.target.value)}
              />
              <em className="muted">Plus élevé = audit plus rapide mais plus gourmand.</em>
            </label>
            <label className="advanced-item">
              <span className="field-label">Délai de stabilisation (ms)</span>
              <input
                type="number"
                id="opt-settle-delay"
                min="0"
                max="5000"
                step="100"
                value={settleDelay}
                onChange={(e) => updateSettleDelay(e.target.value)}
              />
              <em className="muted">Attente après chargement pour laisser les scripts se stabiliser.</em>
            </label>
          </div>
        </details>

        <h3 className="subsection">Type d'audit</h3>
        <div className="audit-cards">
          <button className="audit-card" data-mode="a11y" onClick={() => void startAudit('a11y')}>
            <div className="card-icon a11y" aria-hidden="true">♿</div>
            <div className="card-body">
              <h3>Accessibilité</h3>
              <p>RGAA 4.1.2 / WCAG 2.1</p>
            </div>
          </button>
          <button className="audit-card" data-mode="eco" onClick={() => void startAudit('eco')}>
            <div className="card-icon eco" aria-hidden="true">🌱</div>
            <div className="card-body">
              <h3>Écoconception</h3>
              <p>RGESN 2024 · 9 thématiques</p>
            </div>
          </button>
          <button
            className="audit-card primary"
            data-mode="both"
            onClick={() => void startAudit('both')}
          >
            <div className="card-icon both" aria-hidden="true">✨</div>
            <div className="card-body">
              <h3>Audit complet</h3>
              <p>Accessibilité + Écoconception</p>
            </div>
          </button>
        </div>
      </div>

      <div
        id="panel-saved"
        className={`select-panel${selectTab === 'saved' ? ' active' : ''}`}
        role="tabpanel"
        aria-labelledby="tab-saved"
        hidden={selectTab !== 'saved'}
      >
        {savedAudits.length === 0 && (
          <div id="saved-empty" className="saved-empty">
            <div className="saved-empty-icon" aria-hidden="true">📂</div>
            <p>Aucun audit sauvegardé pour l'instant.</p>
            <p className="muted">
              Lance un audit, puis clique sur <strong>💾 Sauvegarder</strong> pour le retrouver ici.
            </p>
          </div>
        )}
        <ul id="saved-audits-list" className="saved-list">
          {savedAudits.map((a) => {
            const modeLabel =
              a.mode === 'a11y' ? 'A11y' : a.mode === 'eco' ? 'Eco' : 'Complet';
            const dateStr =
              new Date(a.date).toLocaleDateString('fr-FR') +
              ' ' +
              new Date(a.date).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              });
            return (
              <li key={a.id} className="saved-item" data-id={a.id}>
                <div
                  className="saved-item-main"
                  data-id={a.id}
                  onClick={() => loadSavedAudit(a)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && loadSavedAudit(a)}
                >
                  <span className="saved-item-name">{a.name}</span>
                  <span className="saved-item-meta">
                    {a.hostname} · {modeLabel} · {a.pagesResults.length} page(s) · {dateStr}
                  </span>
                </div>
                <button
                  className="saved-item-rename"
                  data-id={a.id}
                  title="Renommer"
                  aria-label="Renommer"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleRename(a.id, a.name);
                  }}
                >
                  ✏️
                </button>
                <button
                  className="saved-item-delete"
                  data-id={a.id}
                  title="Supprimer"
                  aria-label="Supprimer"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(a);
                  }}
                >
                  🗑
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
