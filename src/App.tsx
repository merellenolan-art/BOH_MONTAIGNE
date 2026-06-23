import { useState } from "react";
import { Layout, type View } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { ImportCenter } from "./pages/ImportCenter";
import { MorningDashboard } from "./pages/MorningDashboard";
import { PackagingDashboard } from "./pages/PackagingDashboard";
import { EveningDashboard } from "./pages/EveningDashboard";
import { CitesDashboard } from "./pages/CitesDashboard";
import { ExpeditionsDashboard } from "./pages/ExpeditionsDashboard";
import { MaoDashboard } from "./pages/MaoDashboard";
import { OracleDashboard } from "./pages/OracleDashboard";
import { AdjustmentsDashboard } from "./pages/AdjustmentsDashboard";
import { useStore } from "./lib/useStore";

function App() {
  const [view, setView] = useState<View>("home");
  const [toast, setToast] = useState<string | null>(null);
  const store = useStore();

  function notify(m: string) {
    setToast(m);
    window.setTimeout(() => setToast(null), 3200);
  }

  return (
    <Layout
      view={view}
      setView={setView}
      lastUpdated={store.lastUpdated}
      importCount={store.imports.length}
      toast={toast}
      setToast={setToast}
    >
      {view === "home"        && <HomePage store={store} setView={setView} notify={notify} />}
      {view === "morning"     && <MorningDashboard store={store} setView={setView} notify={notify} />}
      {view === "packaging"   && <PackagingDashboard store={store} notify={notify} />}
      {view === "evening"     && <EveningDashboard store={store} setView={setView} notify={notify} />}
      {view === "cites"       && <CitesDashboard store={store} notify={notify} />}
      {view === "expeditions" && <ExpeditionsDashboard store={store} setView={setView} notify={notify} />}
      {view === "mao"         && <MaoDashboard store={store} setView={setView} notify={notify} />}
      {view === "oracle"      && <OracleDashboard store={store} setView={setView} notify={notify} />}
      {view === "adjustments" && <AdjustmentsDashboard store={store} notify={notify} />}
      {view === "import"      && <ImportCenter store={store} notify={notify} />}
    </Layout>
  );
}

export default App;
