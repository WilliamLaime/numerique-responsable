import { useAuditStore } from './store/auditStore';
import { useAuditRunner } from './hooks/useAuditRunner';
import AppHeader from './components/AppHeader';
import AppFooter from './components/AppFooter';
import SelectScreen from './components/screens/SelectScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import ResultsScreen from './components/screens/ResultsScreen';
import ErrorScreen from './components/screens/ErrorScreen';
import CompareScreen from './components/screens/CompareScreen';
import ContrastChecker from './components/ContrastChecker';

export default function App() {
  const screen = useAuditStore((s) => s.screen);
  const { startAudit } = useAuditRunner();

  return (
    <>
      <AppHeader />
      <main id="main">
        <SelectScreen active={screen === 'select'} startAudit={startAudit} />
        <LoadingScreen active={screen === 'loading'} />
        <ResultsScreen active={screen === 'results'} startAudit={startAudit} />
        <ErrorScreen active={screen === 'error'} />
        <CompareScreen active={screen === 'compare'} />
        <AppFooter />
      </main>
      <ContrastChecker />
    </>
  );
}
