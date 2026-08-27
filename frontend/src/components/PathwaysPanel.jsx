import { GitBranch, ArrowRight } from "lucide-react";
import { useStore } from "../store";
import { PATHWAY_META } from "../data/hospitals";

export default function PathwaysPanel() {
  const { hospital, patients } = useStore();

  const routedToday = patients.filter((p) => p.status === "routed" && p.routing);

  return (
    <div className="panel">
      <div className="flex items-center justify-between border-b border-clinical-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinical-100 text-clinical-600">
            <GitBranch size={16} />
          </div>
          <div>
            <div className="text-sm font-extrabold text-clinical-900">Hospital Care Pathways</div>
            <div className="text-[11px] text-clinical-500">
              {hospital.name} · {hospital.type} · {hospital.volume}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        {/* Pathway cards */}
        <div>
          <div className="panel-title mb-2.5">Configured pathways</div>
          <div className="space-y-2">
            {hospital.pathwayOrder.map((key) => {
              const m = PATHWAY_META[key];
              const Icon = m.icon;
              return (
                <div key={key} className={`flex items-start gap-3 rounded-xl border ${m.border} ${m.bg} px-3.5 py-3 transition-all hover:shadow-sm`}>
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/60 ${m.color}`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${m.color}`}>{m.name}</div>
                    <div className="mt-0.5 text-xs text-clinical-600">{m.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-clinical-200 bg-clinical-50 p-3.5 text-xs text-clinical-600">
            <span className="font-bold text-clinical-800">Same engine, different hospital.</span> Only the pathway
            options change — the ESI triage logic is identical across sites, so a nurse transferring from Harborview to
            West Creek sees the same decision behavior with adjusted routing.
          </div>
        </div>

        {/* Routed-away patients */}
        <div>
          <div className="panel-title mb-2.5">Routed away from the ED today (not triaged)</div>
          {routedToday.length === 0 && (
            <div className="rounded-xl border border-dashed border-clinical-200 p-6 text-center text-xs text-clinical-400">
              No non-emergency patients yet.
            </div>
          )}
          <div className="space-y-2">
            {routedToday.map((p) => (
              <div key={p.id} className="rounded-xl border border-clinical-200 bg-white px-3.5 py-3 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-clinical-800">
                    {p.name} <span className="font-normal text-clinical-400">· {p.id} · {p.age}y</span>
                  </div>
                  <span className="badge bg-emerald-100 text-emerald-800">{p.routing.pathwayName}</span>
                </div>
                <div className="mt-1 line-clamp-1 text-[11px] text-clinical-500">{p.complaint}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-clinical-500">
                  <span className="flex items-center gap-1">
                    <GitBranch size={11} /> {p.routing.reason}
                  </span>
                  <ArrowRight size={11} className="shrink-0 text-clinical-400" />
                  <span className="font-semibold text-clinical-600">{p.routing.detail}</span>
                </div>
              </div>
            ))}
          </div>

          {hospital.specialties.length > 0 && (
            <div className="mt-4">
              <div className="panel-title mb-2">On-site specialties</div>
              <div className="flex flex-wrap gap-1.5">
                {hospital.specialties.map((s) => (
                  <span key={s} className="badge bg-clinical-100 text-clinical-600">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-clinical-400" />
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
