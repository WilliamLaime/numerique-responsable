import { useState } from 'react';
import { useContrastChecker } from '../hooks/useContrastChecker';
import { useAuditStore } from '../store/auditStore';

export default function ContrastChecker() {
  const [open, setOpen] = useState(false);
  const { result, loading, check, reset } = useContrastChecker();
  const referential = useAuditStore((s) => s.referential);

  const renderResult = () => {
    if (!result) return null;

    if (result.error === 'no-selection') {
      return <p className="contrast-message">Aucun texte sélectionné sur la page.</p>;
    }
    if (result.error === 'injection-failed') {
      return <p className="contrast-message contrast-message--error">Impossible d'analyser la page (page système ou restreinte).</p>;
    }
    if (result.error === 'image-bg') {
      return (
        <div className="contrast-result-card">
          <p className="contrast-result-text">« {result.text} »</p>
          <div className="contrast-swatches">
            <span className="color-swatch" style={{ background: result.fg }} title={result.fg} />
            <span>{result.fg}</span>
            <span style={{ color: '#9ca3af' }}>sur</span>
            <span>fond image/dégradé</span>
          </div>
          <p className="contrast-message">Fond image ou dégradé détecté — contraste non calculable automatiquement.</p>
        </div>
      );
    }

    const { ratio, passAA, passAAA, fg, bg, fontSizePx, fontWeight, isLargeText, text } = result;
    if (ratio === null) return null;

    const ratioClass = passAA ? 'pass' : 'fail';

    return (
      <div className="contrast-result-card">
        <p className="contrast-result-text">« {text} »</p>
        <div className="contrast-swatches">
          <span className="color-swatch" style={{ background: fg }} title={fg} />
          <span>{fg}</span>
          <span style={{ color: '#9ca3af' }}>sur</span>
          <span className="color-swatch" style={{ background: bg! }} title={bg!} />
          <span>{bg}</span>
        </div>
        <p className="contrast-meta">
          {fontSizePx} px · {fontWeight} · {isLargeText ? 'Grand texte' : 'Texte normal'}
        </p>
        <p className={`contrast-ratio ${ratioClass}`}>{ratio.toFixed(2)} : 1</p>
        <div className="contrast-badges">
          {referential === 'rgaa' ? (
            <span className={`contrast-badge ${passAA ? 'pass' : 'fail'}`}>
              {passAA ? '✓' : '✗'} AA — RGAA 3.2
            </span>
          ) : (
            <>
              <span className={`contrast-badge ${passAA ? 'pass' : 'fail'}`}>
                {passAA ? '✓' : '✗'} AA — WCAG 1.4.3
              </span>
              <span className={`contrast-badge ${passAAA ? 'pass' : 'fail'}`}>
                {passAAA ? '✓' : '✗'} AAA — WCAG 1.4.6
              </span>
            </>
          )}
          {isLargeText && (
            <span className="contrast-badge na">Grand texte (seuil abaissé)</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="contrast-checker">
      <button
        className="contrast-checker-header"
        aria-expanded={open}
        aria-controls="contrast-checker-body"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="contrast-checker-title">
          <span className="cc-icon" aria-hidden="true">◑</span>
          Vérificateur de contraste
        </span>
        <svg className="contrast-chevron" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4,6 8,10 12,6" />
        </svg>
      </button>

      {open && (
        <div className="contrast-checker-body" id="contrast-checker-body">
          <p className="contrast-instruction">
            Sélectionnez du texte sur la page, puis cliquez sur Vérifier.
          </p>
          <div className="contrast-actions">
            <button
              className="btn btn-sm"
              onClick={check}
              disabled={loading}
            >
              {loading ? 'Analyse…' : 'Vérifier le contraste'}
            </button>
            {result && (
              <button className="btn btn-sm btn-ghost" onClick={reset}>
                Réinitialiser
              </button>
            )}
          </div>
          {renderResult()}
        </div>
      )}
    </section>
  );
}
