import { useState } from "react";
import {
  ArrowRightLeft, CheckCircle2, ListChecks, RotateCcw, TriangleAlert, AlertTriangle, Clock, Inbox,
} from "lucide-react";
import { useStore } from "../store";
import { ESI_META, SLA_MINUTES } from "../lib/esi";
import { formatClock, minutesBetween, initialsOf } from "../lib/format";
import EsiBadge from "./EsiBadge";
import OverrideModal from "./OverrideModal";
import ReassessModal from "./ReassessModal";

const CONF_CHIP = {
  High: "bg-emerald-100 text-emerald-800",
  Medium: "bg-amber-100 text-amber-800",
  Low: "bg-red-100 text-red-800",
};

const AVATAR_BG = {
  1: "bg-red-100 text-red-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-amber-100 text-amber-700",
  4: "bg-blue-100 text-blue-700",
  5: "bg-green-100 text-green-700",
};

export default function QueueTable() {
  const { queue, effectiveNow, accept, overridePatient, reassess, currentLevel } = useStore();
  const [overrideFor, setOverrideFor] = useState(null);
  const [reassessFor, setReassessFor] = useState(null);

  const rowState = (p) => {
    const lvl = currentLevel(p);
    const wait = minutesBetween(p.arrivedAt, effectiveNow);
    const sla = SLA_MINUTES[lvl] ?? 120;
    const breached = wait >= sla && lvl >= 2;
    const decision = p.clinicianDecision;
    const status = decision
      ? decision.kind === "override" ? "overridden" : "accepted"
      : lvl <= 2 ? "active" : "waiting";
    const slaPercent = Math.min(100, Math.round((wait / sla) * 100));
    return { lvl, wait, breached, status, slaPercent, sla };
  };

  const reassessmentIndicator = (p, st) => {
    if (p.deteriorated && p.initialTriage)
      return <span className="badge bg-red-600 text-white shadow-sm"><TriangleAlert size={11} /> Deterioration</span>;
    if (st.breached)
      return <span className="badge bg-amber-100 text-amber-800"><Clock size={11} /> SLA</span>;
    if (p.triage?.confidence === "Low")
      return <span className="badge bg-orange-100 text-orange-800"><AlertTriangle size={11} /> Low conf</span>;
    return <span className="text-xs text-clinical-400">—</span>;
  };

  const STATUS_BADGE = {
    active: { label: "Active", cls: "bg-red-100 text-red-800" },
    waiting: { label: "Waiting", cls: "bg-blue-100 text-blue-800" },
    accepted: { label: "Accepted", cls: "bg-emerald-100 text-emerald-800" },
    overridden: { label: "Overridden", cls: "bg-amber-100 text-amber-800" },
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-clinical-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinical-100 text-clinical-600">
            <ListChecks size={16} />
          </div>
          <div>
            <div className="text-sm font-extrabold text-clinical-900">Current ED Queue</div>
            <div className="text-[11px] text-clinical-500">
              {queue.length} patients · sorted by severity (ESI), then longest wait
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-3 text-[11px] font-medium text-clinical-500 sm:flex">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> P1</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> P2</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> P3</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> P4</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> P5</span>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-clinical-100 bg-clinical-50/80 text-[11px] uppercase tracking-wide text-clinical-500">
              <th className="px-4 py-2.5 font-bold">Patient</th>
              <th className="px-3 py-2.5 font-bold">Chief complaint</th>
              <th className="px-3 py-2.5 font-bold">ESI</th>
              <th className="px-3 py-2.5 font-bold">Arrival</th>
              <th className="px-3 py-2.5 font-bold">Waiting</th>
              <th className="px-3 py-2.5 font-bold">Pathway</th>
              <th className="px-3 py-2.5 font-bold">Confidence</th>
              <th className="px-3 py-2.5 font-bold">Status</th>
              <th className="px-3 py-2.5 font-bold">Reassess</th>
              <th className="px-3 py-2.5 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((p) => {
              const st = rowState(p);
              const isP1 = st.lvl === 1;
              const isP2 = st.lvl === 2;
              const conf = p.triage?.confidence;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-clinical-100 transition-all duration-200 ${
                    isP1 ? "bg-red-50/60" : isP2 ? "bg-orange-50/50" : st.breached ? "bg-amber-50/50" : "hover:bg-clinical-50/80"
                  }`}
                >
                  <td className={`px-4 py-3 ${isP1 ? "border-l-[3px] border-red-500" : isP2 ? "border-l-[3px] border-orange-500" : "border-l-[3px] border-transparent"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`avatar ${AVATAR_BG[st.lvl] ?? "bg-clinical-100 text-clinical-600"}`}>
                        {initialsOf(p.name)}
                      </div>
                      <div>
                        <div className={`font-bold ${isP1 || isP2 ? "text-clinical-900" : "text-clinical-800"}`}>
                          {p.id}
                          {isP1 && <span className="ml-1.5 text-[10px] font-black text-red-600">P1</span>}
                          {isP2 && <span className="ml-1.5 text-[10px] font-black text-orange-600">P2</span>}
                        </div>
                        <div className="text-[11px] text-clinical-500">
                          {p.name} · {p.age} · {p.sex}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[220px] px-3 py-3 text-xs text-clinical-600" title={p.complaint}>
                    <span className="line-clamp-2">{p.complaint}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <EsiBadge level={st.lvl} size="sm" />
                      {p.clinicianDecision?.kind === "override" && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-700">
                          AI {p.triage?.esi ?? "—"} <ArrowRightLeft size={10} /> {p.clinicianDecision.level}
                        </span>
                      )}
                      {p.deteriorated && p.initialTriage && (
                        <span className="text-[10px] font-black text-red-700">
                          {p.initialTriage.esi} → {p.triage.esi}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs tabular-nums text-clinical-600">{formatClock(p.arrivedAt)}</td>
                  <td className="px-3 py-3">
                    <div className="font-mono text-xs font-bold tabular-nums text-clinical-800">{st.wait} min</div>
                    {/* SLA progress bar */}
                    <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-clinical-100">
                      <div
                        className={`h-full rounded-full transition-all ${st.breached ? "bg-red-500" : st.slaPercent > 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{ width: `${Math.min(100, st.slaPercent)}%` }}
                      />
                    </div>
                    <div className={`mt-0.5 text-[10px] ${st.breached ? "font-bold text-red-600" : "text-clinical-400"}`}>
                      {st.breached ? `> ${SLA_MINUTES[st.lvl]}m SLA` : `SLA ${SLA_MINUTES[st.lvl]}m`}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-clinical-700">{p.routing?.pathwayName ?? "Emergency"}</td>
                  <td className="px-3 py-3">
                    {conf ? (
                      <span className={`badge ${CONF_CHIP[conf]}`}>
                        {conf} {p.triage.confidenceScore}%
                      </span>
                    ) : (
                      <span className="text-xs text-clinical-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`badge ${STATUS_BADGE[st.status].cls}`}>{STATUS_BADGE[st.status].label}</span>
                  </td>
                  <td className="px-3 py-3">{reassessmentIndicator(p, st)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {!p.clinicianDecision ? (
                        <>
                          <button
                            onClick={() => accept(p.id)}
                            className="btn btn-sm bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                            title="Accept AI recommendation"
                          >
                            <CheckCircle2 size={13} /> Accept
                          </button>
                          <button
                            onClick={() => setOverrideFor(p)}
                            className="btn btn-sm btn-ghost"
                            title="Override recommendation"
                          >
                            <AlertTriangle size={13} /> Override
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] font-semibold text-clinical-500">
                          {p.clinicianDecision.kind === "override" ? "Reviewed" : "Accepted"}
                        </span>
                      )}
                      <button
                        onClick={() => setReassessFor(p)}
                        className="btn btn-sm border border-clinical-200 bg-white text-clinical-600 hover:bg-clinical-50"
                        title="Re-check vitals"
                      >
                        <RotateCcw size={13} /> Recheck
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {queue.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clinical-100">
              <Inbox size={24} className="text-clinical-400" />
            </div>
            <div className="text-sm font-semibold text-clinical-500">Queue is empty</div>
            <div className="text-xs text-clinical-400">New patients will appear here after intake and triage.</div>
          </div>
        )}
      </div>

      {/* Mobile card layout */}
      <div className="divide-y divide-clinical-100 lg:hidden">
        {queue.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clinical-100">
              <Inbox size={24} className="text-clinical-400" />
            </div>
            <div className="text-sm font-semibold text-clinical-500">Queue is empty</div>
          </div>
        )}
        {queue.map((p) => {
          const st = rowState(p);
          const isP1 = st.lvl === 1;
          const isP2 = st.lvl === 2;
          const conf = p.triage?.confidence;
          return (
            <div
              key={p.id}
              className={`px-4 py-3.5 ${isP1 ? "border-l-[3px] border-l-red-500 bg-red-50/50" : isP2 ? "border-l-[3px] border-l-orange-500 bg-orange-50/40" : st.breached ? "bg-amber-50/40" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`avatar ${AVATAR_BG[st.lvl] ?? "bg-clinical-100 text-clinical-600"}`}>
                    {initialsOf(p.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-clinical-900">{p.id}</span>
                      <EsiBadge level={st.lvl} size="sm" />
                    </div>
                    <div className="text-[11px] text-clinical-500">{p.name} · {p.age} · {p.sex}</div>
                  </div>
                </div>
                <span className={`badge ${STATUS_BADGE[st.status].cls}`}>{STATUS_BADGE[st.status].label}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-clinical-600">{p.complaint}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-mono font-bold tabular-nums text-clinical-700">{st.wait} min waiting</span>
                <span className="text-clinical-400">·</span>
                <span className="text-clinical-500">{p.routing?.pathwayName ?? "Emergency"}</span>
                {conf && (
                  <>
                    <span className="text-clinical-400">·</span>
                    <span className={`badge ${CONF_CHIP[conf]}`}>{conf}</span>
                  </>
                )}
              </div>
              {/* SLA bar mobile */}
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-clinical-100">
                <div
                  className={`h-full rounded-full transition-all ${st.breached ? "bg-red-500" : st.slaPercent > 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${Math.min(100, st.slaPercent)}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                {!p.clinicianDecision ? (
                  <>
                    <button onClick={() => accept(p.id)} className="btn btn-sm flex-1 bg-emerald-600 text-white hover:bg-emerald-700">
                      <CheckCircle2 size={13} /> Accept
                    </button>
                    <button onClick={() => setOverrideFor(p)} className="btn btn-sm flex-1 btn-ghost">
                      <AlertTriangle size={13} /> Override
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] font-semibold text-clinical-500">
                    {p.clinicianDecision.kind === "override" ? "Reviewed" : "Accepted"}
                  </span>
                )}
                <button onClick={() => setReassessFor(p)} className="btn btn-sm border border-clinical-200 bg-white text-clinical-600 hover:bg-clinical-50">
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {overrideFor && (
        <OverrideModal
          open
          patientName={overrideFor.name}
          aiEsi={overrideFor.triage?.esi ?? 3}
          onClose={() => setOverrideFor(null)}
          onSubmit={(d) => overridePatient(overrideFor.id, d)}
        />
      )}
      {reassessFor && (
        <ReassessModal open patient={reassessFor} onClose={() => setReassessFor(null)} />
      )}
    </div>
  );
}
