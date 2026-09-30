import { useAppStore } from "./store/useAppStore";
import TopBar from "./components/layout/TopBar";
import Sidebar from "./components/layout/Sidebar";
import ChartContainer from "./components/chart/ChartContainer";
import StrategyBuilder from "./components/strategy/StrategyBuilder";
import ResultsDashboard from "./components/results/ResultsDashboard";

export default function App() {
  const { activeTab } = useAppStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopBar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {activeTab === "chart" && <ChartContainer />}
          {activeTab === "strategy" && <StrategyBuilder />}
          {activeTab === "results" && <ResultsDashboard />}
        </main>
      </div>
    </div>
  );
}
