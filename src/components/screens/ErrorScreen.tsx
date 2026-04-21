import { useAuditStore } from '../../store/auditStore';

interface Props {
  active: boolean;
}

export default function ErrorScreen({ active }: Props) {
  const setScreen = useAuditStore((s) => s.setScreen);
  const errorMessage = useAuditStore((s) => s.errorMessage);

  return (
    <section id="screen-error" className={`screen${active ? ' active' : ''}`}>
      <div className="error-box">
        <div className="error-icon" aria-hidden="true">⚠️</div>
        <h3>Impossible d'analyser cette page</h3>
        <p id="error-message">
          {errorMessage || "Les pages internes du navigateur ne peuvent pas être auditées."}
        </p>
        <button id="error-back" className="btn-primary" onClick={() => setScreen('select')}>
          Retour
        </button>
      </div>
    </section>
  );
}
