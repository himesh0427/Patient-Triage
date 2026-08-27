import { useState } from "react";
import { BellRing, Clock, TriangleAlert, AlertTriangle, RotateCcw, CheckCircle2 } from "lucide-react";
import { useStore } from "../store";
import EsiBadge from "./EsiBadge";
import ReassessModal from "./ReassessModal";

const KIND_META = {
  deterioration: { icon: TriangleAlert, cls: "bg-red-50 border-red-200 text-red-800", iconCls: "bg-red-100 text-red-600", borderColor: "border-l-red-500", label: "DETERIORATION DETECTED" },
  sla: { icon: Clock, cls: "bg-amber-50 border-amber-200 text-amber-800", iconCls: "bg-amber-100 text-amber-600", borderColor: "border-l-amber-400", label: "WAIT EXCEEDED" },
  uncertain: { icon: AlertTriangle, cls: "bg-orange-50 border-orange-200 text-orange-800", iconCls: "bg-orange-100 text-orange-600", borderColor: "border-l-orange-400", label: "ASSESSMENT UNCERTAIN" },
};

export default function ReassessmentAlerts() {
  const { alerts, currentLevel } = useStore();
  const [reassessFor, setReassessFor] = useState(null);

  return (
    <div className="panel">
      <div className="flex items-center justify-between border-b border-clinical-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinical-100 text-clinical-600">
            <BellRing size={16} />
          </div>
          <div>
            <div className="text-sm font-extrabold text-clinical-900">Reassessment Alerts</div>
            <div className="text-[11px] text-clinical-500">
              {alerts.length} patients need attention
            </div>
          </div>
        </div>
        <span className={`badge ${alerts.length > 0 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
          {alerts.length > 0 && (
            <span className="relative mr-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          )}
          {alerts.length}
        </span>
      </div>

      <div className="max-h-[380px] divide-y divide-clinical-100 overflow-y-auto">
        {alerts.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <div className="text-sm font-semibold text-emerald-700">All clear</div>
            <div className="text-xs text-clinical-400">All patients within safe reassessment thresholds.</div>
          </div>
        )}
        {alerts.map((a, i) => {
          const meta = KIND_META[a.kind];
          const Icon = meta.icon;
          const p = a.patient;
          return (
            <div key={i} className={`flex items-start gap-3 border-l-[3px] px-4 py-3.5 transition-colors hover:bg-white/50 ${meta.cls} ${meta.borderColor}`}>
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.iconCls}`}>
                <Icon size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black tracking-wide">{meta.label}</span>
                  <EsiBadge level={currentLevel(p)} size="sm" />
                  {a.kind === "deterioration" && (
                    <span className="text-[11px] font-bold">
                      ESI {p.initialTriage.esi} → ESI {p.triage.esi}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-clinical-800">{p.name} · {p.id}</div>
                <div className="mt-0.5 text-xs text-clinical-600">{a.detail}</div>
              </div>
              <button
                onClick={() => setReassessFor(p)}
                className="btn btn-sm shrink-0 bg-white text-clinical-700 shadow-sm hover:bg-clinical-50"
              >
                <RotateCcw size={13} /> Reassess
              </button>
            </div>
          );
        })}
      </div>

      {reassessFor && (
        <ReassessModal open patient={reassessFor} onClose={() => setReassessFor(null)} />
      )}
    </div>
  );
}
