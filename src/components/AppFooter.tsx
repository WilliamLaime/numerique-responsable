export default function AppFooter() {
  const v = chrome.runtime.getManifest().version;
  return (
    <footer className="app-footer">
      <span>Numérique Responsable · v{v}</span>
    </footer>
  );
}
