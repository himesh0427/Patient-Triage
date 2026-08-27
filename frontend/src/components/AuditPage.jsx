import { FileCheck2, History, ShieldCheck, ArrowRightLeft, Activity } from "lucide-react";
import { useStore } from "../store";
import { formatDateTime } from "../lib/format";
import EsiBadge from "./EsiBadge";

const ACTION_META = {
  ai_recommendation: { label: "AI recommendation", cls: "bg-clinical-100 text-clinical-700" },
  clinician_accept: { label: "Clinician accepted", cls: "bg-emerald-100 text-emerald-800" },
  clinician_override: { label: "Clinician override", cls: "bg-amber-100 text-amber-800" },
  ai_reassessment: { label: "AI reassessment", cls: "bg-red-100 text-red-800" },
  ai_recheck: { label: "Routine re-check", cls: "bg-blue-100 text-blue-800" },
};

const STAT_ICONS = [
  { key: "total", label: "Total decisions logged", icon: History, tone: "bg-clinical-100 text-clinical-600" },
  { key: "overrides", label: "Clinician overrides", icon: ArrowRightLeft, tone: "bg-amber-100 text-amber-600" },
  { key: "accepts", label: "Recommendations accepted", icon: FileCheck2, tone: "bg-emerald-100 text-emerald-600" },
  { key: "reassessments", label: "Reassessments / re-checks", icon: Activity, tone: "bg-blue-100 text-blue-600" },
];

export default function AuditPage() {
  const { audit, patients } = useStore();

  const stats = {
    total: audit.length,
    overrides: audit.filter((a) => a.action === "clinician_override").length,
    accepts: audit.filter((a) => a.action === "clinician_accept").length,
    reassessments: audit.filter((a) => a.action === "ai_reassessment" || a.action === "ai_recheck").length,
  };

  const lastOverride = audit.find((a) => a.action === "clinician_override");

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_ICONS.map((s) => (
          <div key={s.key} className="panel flex items-center gap-3.5 p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
              <s.icon size={18} />
            </div>
            <div>
              <div className="text-2xl font-extrabold tabular-nums tracking-tight text-clinical-900">{stats[s.key]}</div>
              <div className="text-[11px] font-semibold text-clinical-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Example override audit card */}
        <div className="panel p-5 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <ShieldCheck size={16} className="text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-clinical-900">Override audit record</div>
              <div className="text-[11px] text-clinical-500">What the compliance log captures</div>
            </div>
          </div>
          {lastOverride ? (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 font-mono text-xs text-clinical-800">
              <div><span className="font-bold text-amber-700">Patient</span> {lastOverride.patientName} ({lastOverride.patientId})</div>
              <div><span className="font-bold text-amber-700">AI recommendation:</span> ESI {lastOverride.aiEsi}</div>
              <div><span className="font-bold text-amber-700">Clinician decision:</span> ESI {lastOverride.finalEsi}</div>
              <div><span className="font-bold text-amber-700">Reason:</span> {lastOverride.overrideReason}</div>
              <div><span className="font-bold text-amber-700">Time:</span> {formatDateTime(new Date(lastOverride.at))}</div>
              <div><span className="font-bold text-amber-700">User:</span> {lastOverride.clinician}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-clinical-200 p-6 text-center text-xs text-clinical-400">No overrides logged yet.</div>
          )}
          <p className="mt-3.5 text-[11px] leading-relaxed text-clinical-500">
            Every AI recommendation and every clinician decision is written to an immutable audit trail (with model version
            and timestamp) for accountability and health-data compliance (e.g. HIPAA/GDPR-style record keeping).
          </p>
        </div>

        {/* Full audit table */}
        <div className="panel overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-clinical-100 px-5 py-3.5">
            <div>
              <div className="text-sm font-extrabold text-clinical-900">Audit &amp; Decisions — full trail</div>
              <div className="text-[11px] text-clinical-500">Most recent first · append-only</div>
            </div>
            <span className="badge bg-clinical-900 text-white">{audit.length} entries</span>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-clinical-50/95 text-[11px] uppercase tracking-wide text-clinical-500 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Time</th>
                  <th className="px-3 py-2.5 font-bold">Patient</th>
                  <th className="px-3 py-2.5 font-bold">AI rec</th>
                  <th className="px-3 py-2.5 font-bold">Final</th>
                  <th className="px-3 py-2.5 font-bold">Action</th>
                  <th className="px-3 py-2.5 font-bold">Override reason</th>
                  <th className="px-3 py-2.5 font-bold">User</th>
                  <th className="px-3 py-2.5 font-bold">Important changes</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a, idx) => {
                  const meta = ACTION_META[a.action] ?? ACTION_META.ai_recommendation;
                  return (
                    <tr key={a.id} className={`border-b border-clinical-100 align-top transition-colors hover:bg-clinical-50/80 ${idx % 2 === 0 ? "" : "bg-clinical-50/30"}`}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-clinical-500">
                        {formatDateTime(new Date(a.at))}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs font-bold text-clinical-800">{a.patientName}</div>
                        <div className="text-[10px] text-clinical-400">{a.patientId}</div>
                      </td>
                      <td className="px-3 py-2.5">{a.aiEsi != null ? <EsiBadge level={a.aiEsi} size="sm" /> : <span className="text-xs text-clinical-400">—</span>}</td>
                      <td className="px-3 py-2.5">
                        {a.finalEsi != null ? (
                          a.action === "clinician_override" ? (
                            <EsiBadge level={a.finalEsi} size="sm" variant="solid" />
                          ) : (
                            <EsiBadge level={a.finalEsi} size="sm" />
                          )
                        ) : (
                          <span className="text-xs text-clinical-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><span className={`badge ${meta.cls}`}>{meta.label}</span></td>
                      <td className="max-w-[220px] px-3 py-2.5 text-xs text-clinical-600">{a.overrideReason ?? <span className="text-clinical-300">—</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-clinical-600">{a.clinician}</td>
                      <td className="max-w-[200px] px-3 py-2.5 text-xs text-clinical-600">{a.importantChange ?? <span className="text-clinical-300">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
