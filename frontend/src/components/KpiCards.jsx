import { Users, AlertOctagon, RotateCcw, Clock, Gauge } from "lucide-react";
import { useStore } from "../store";
import { minutesBetween } from "../lib/format";

function Kpi({ icon: Icon, label, value, sub, tone = "default", accent }) {
  const tones = {
    default: { icon: "bg-clinical-100 text-clinical-600", value: "text-clinical-900", border: "" },
    critical: { icon: "bg-red-100 text-red-600", value: "text-red-700", border: "border-t-2 border-t-red-500" },
    warn: { icon: "bg-amber-100 text-amber-600", value: "text-amber-700", border: "border-t-2 border-t-amber-400" },
    success: { icon: "bg-emerald-100 text-emerald-600", value: "text-emerald-700", border: "border-t-2 border-t-emerald-400" },
  };
  const t = tones[tone];
  return (
    <div className={`panel relative flex items-center gap-3.5 overflow-hidden p-4 ${t.border} ${accent ?? ""}`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-extrabold leading-none tabular-nums tracking-tight ${t.value}`}>{value}</div>
        <div className="mt-1 truncate text-xs font-semibold text-clinical-500">{label}</div>
        {sub && <div className="mt-0.5 truncate text-[11px] text-clinical-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function KpiCards() {
  const { kpis, surgeOn } = useStore();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Kpi icon={Users} label="Patients waiting" value={kpis.waiting} sub="In active ED queue" />
      <Kpi
        icon={AlertOctagon}
        label="P1 / P2 critical"
        value={kpis.critical}
        tone="critical"
        sub="Need immediate attention"
        accent="border-l-4 border-l-red-500"
      />
      <Kpi
        icon={RotateCcw}
        label="Requiring reassessment"
        value={kpis.reassessCount}
        tone="warn"
        sub="SLA / deterioration / uncertainty"
        accent="border-l-4 border-l-amber-400"
      />
      <Kpi icon={Clock} label="Average waiting time" value={`${kpis.avgWait} min`} sub="Across queue" />
      <Kpi
        icon={Gauge}
        label="Surge status"
        value={surgeOn ? "3× SURGE" : "Normal"}
        tone={surgeOn ? "critical" : "success"}
        sub={surgeOn ? "Volume simulation active" : "Steady-state operations"}
      />
    </div>
  );
}
