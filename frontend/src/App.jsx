import { useState } from "react";
import {
  LayoutDashboard, ScrollText, Activity, Route, ClipboardCheck,
  MessageSquareText, Eye, RotateCcw, UserCheck, Radio, Stethoscope,
} from "lucide-react";
import { StoreProvider, useStore } from "./store";
import Header from "./components/Header";
import SurgeBanner from "./components/SurgeBanner";
import KpiCards from "./components/KpiCards";
import IntakePanel from "./components/IntakePanel";
import QueueTable from "./components/QueueTable";
import ReassessmentAlerts from "./components/ReassessmentAlerts";
import PathwaysPanel from "./components/PathwaysPanel";
import AuditPage from "./components/AuditPage";
import TriageFlowPage from "./components/triage/TriageFlowPage";

const FLOW = [
  { icon: Eye, label: "Understand" },
  { icon: Route, label: "Route" },
  { icon: ClipboardCheck, label: "Triage" },
  { icon: MessageSquareText, label: "Explain" },
  { icon: Activity, label: "Monitor" },
  { icon: RotateCcw, label: "Reassess" },
  { icon: UserCheck, label: "Clinician decides" },
];

function FooterStrip() {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 border-t border-clinical-200 pt-6 text-center">
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-clinical-500 sm:gap-2 sm:text-[11px]">
        {FLOW.map((f, i) => (
          <span key={f.label} className="flex items-center gap-1.5 sm:gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-clinical-200 bg-white px-2 py-1 text-clinical-600 shadow-sm transition-colors hover:border-clinical-300 hover:text-clinical-800 sm:px-2.5">
              <f.icon size={11} /> {f.label}
            </span>
            {i < FLOW.length - 1 && <span className="text-clinical-300">→</span>}
          </span>
        ))}
      </div>
      <p className="max-w-3xl text-[11px] leading-relaxed text-clinical-400">
        PatientTriage.ai is a clinical decision-SUPPORT prototype. It does not diagnose and does not replace clinical
        judgment — every recommendation is explainable, reviewable, and overridable by a licensed clinician, with a
        full audit trail for accountability and health-data compliance. Simulated demo data only.
      </p>
    </div>
  );
}

function Dashboard() {
  const { surgeOn, toggleSurge } = useStore();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-clinical-900 lg:text-2xl">Emergency Department Overview</h1>
          <p className="mt-0.5 text-sm text-clinical-500">Real-time patient queue, triage, and monitoring</p>
        </div>
        <button
          onClick={toggleSurge}
          className={`btn ${surgeOn ? "btn-ghost border-clinical-300 text-clinical-600 hover:bg-clinical-100" : "btn-primary"}`}
        >
          <Radio size={16} className={surgeOn ? "animate-pulseDot" : ""} />
          {surgeOn ? "End Surge Simulation" : "Simulate 3× Surge"}
        </button>
      </div>

      <KpiCards />
      <SurgeBanner />

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <IntakePanel />
        </div>
        <div className="xl:col-span-3">
          <QueueTable />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReassessmentAlerts />
        <PathwaysPanel />
      </div>
    </div>
  );
}

function NavTabs({ tab, setTab }) {
  const { audit } = useStore();
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "triage", label: "New Triage", icon: Stethoscope, badge: "AI", badgeClass: "bg-clinical-100 text-clinical-700" },
    { id: "audit", label: "Audit & Decisions", icon: ScrollText, badge: audit.length, badgeClass: "bg-clinical-100 text-clinical-600" },
  ];
  return (
    <nav className="border-b border-clinical-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-[1600px] gap-1 px-4 lg:px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`nav-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "text-clinical-900"
                : "text-clinical-500 hover:text-clinical-700"
            }`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <t.icon size={16} />
            {t.label}
            {t.badge !== undefined && (
              <span className={`badge ${t.badgeClass}`}>{t.badge}</span>
            )}
            {tab === t.id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-t-full bg-clinical-600" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

function App() {
  const [tab, setTab] = useState("dashboard");
  return (
    <StoreProvider>
      <div className="min-h-screen bg-clinical-100">
        <Header />
        <NavTabs tab={tab} setTab={setTab} />

        <main className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6 lg:py-6">
          <div className="animate-fadeIn" key={tab}>
            {tab === "dashboard" && <Dashboard />}
            {tab === "triage" && <TriageFlowPage />}
            {tab === "audit" && <AuditPage />}
          </div>
          <FooterStrip />
        </main>
      </div>
    </StoreProvider>
  );
}

export default App;
