import { useAuditStore } from '../../store/auditStore';
import { cancelRunningAudit } from '../../hooks/useAuditRunner';

interface Props {
  active: boolean;
}

export default function LoadingScreen({ active }: Props) {
  const loadingText = useAuditStore((s) => s.loadingText);
  const auditedCount = useAuditStore((s) => s.auditedCount);
  const failedUrls = useAuditStore((s) => s.failedUrls);
  const totalUrls = useAuditStore((s) => s.totalUrls);
  const progressUrl = useAuditStore((s) => s.progressUrl);

  const done = auditedCount + failedUrls.length;
  const pct = totalUrls ? Math.round((done / totalUrls) * 100) : 0;

  return (
    <section id="screen-loading" className={`screen${active ? ' active' : ''}`}>
      <div className="loader">
        <div className="spinner" aria-hidden="true"></div>
        <p id="loading-text">{loadingText || 'Analyse en cours...'}</p>
        <div className="progress-wrap">
          <div className="progress-bar">
            <div
              className="progress-fill"
              id="progress-fill"
              style={{ width: `${pct}%` }}
            ></div>
          </div>
          <p id="progress-url" className="progress-url">{progressUrl}</p>
        </div>
        <button
          id="cancel-btn"
          className="btn-secondary cancel-btn"
          onClick={() => void cancelRunningAudit()}
        >
          ← Annuler l'audit
        </button>
      </div>
    </section>
  );
}
