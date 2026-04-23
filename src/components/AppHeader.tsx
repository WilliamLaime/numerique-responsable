export default function AppHeader() {
  const isWindow = new URLSearchParams(location.search).get('mode') === 'window';

  const handleDetach = () => {
    chrome.runtime.sendMessage({ type: 'detach-window' });
  };

  return (
    <header className="app-header">
      <div className="logo">
        <span className="logo-leaf" aria-hidden="true">🌿</span>
        <div>
          <h1>Numérique Responsable</h1>
          <p className="subtitle">Audit accessibilité &amp; écoconception</p>
        </div>
      </div>
      {!isWindow && (
        <button
          id="detach-btn"
          className="icon-btn"
          title="Ouvrir en fenêtre"
          aria-label="Ouvrir en fenêtre détachée"
          onClick={handleDetach}
        >
          ⧉
        </button>
      )}
    </header>
  );
}
