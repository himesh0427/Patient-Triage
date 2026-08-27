import { useState } from "react";
import {
  AlertTriangle, ArrowUp, CheckCircle2, ChevronDown, Info, ShieldAlert,
  ShieldCheck, Stethoscope, CircleAlert,
} from "lucide-react";
import { ESI_META } from "../lib/esi";
import EsiBadge from "./EsiBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";

function WhySection({ triage }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-amber-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50/80"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          <Info size={13} /> Why was this escalated?
        </span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="animate-fadeIn space-y-2 px-4 pb-3.5 text-xs text-amber-900">
          <p>
            The risk engine scored this patient at <strong>L{triage.esi + (triage.escalated ? 1 : 0)}</strong>, but the
            deterministic safety policy overrode that score:
          </p>
          <ul className="list-disc space-y-1.5 pl-4">
            <li>Decision confidence is <strong>{triage.confidence}</strong> ({triage.confidenceScore}%).</li>
            <li>Safety-first rule: <strong>low/medium confidence escalates one tier toward more urgent</strong> — it can never silently downgrade.</li>
            <li>Missing data ({triage.missingLabels.join(", ") || "none"}) and symptom conflicts widen the uncertainty margin.</li>
            <li>Under-triage is categorically more harmful than over-prioritization — so the system errs on the side of escalation.</li>
          </ul>
          <p className="text-amber-700">A licensed clinician always makes the final call — see Accept / Override.</p>
        </div>
      )}
    </div>
  );
}

export default function TriageCard({ triage, patientName, onAccept, onOverride, showActions = true }) {
  const meta = ESI_META[triage.esi] ?? ESI_META[5];
  const isP1 = triage.esi === 1;
  const isP2 = triage.esi === 2;

  return (
    <div className={`animate-fadeInUp overflow-hidden rounded-xl border shadow-card ${meta.border}`}>
      {/* Header band */}
      <div className={`${meta.softBg} border-b ${meta.border} px-5 py-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${meta.bg} text-white shadow-lg`}>
              <span className="text-3xl font-black tabular-nums">P{triage.esi}</span>
            </div>
            <div>
              <div className={`text-lg font-extrabold tracking-tight ${meta.text}`}>
                ESI {triage.esi} — {meta.label.toUpperCase()}
              </div>
              <div className="mt-0.5 text-xs font-medium text-clinical-500">{meta.description}</div>
            </div>
          </div>
          <EsiBadge level={triage.esi} variant="solid" size="lg" />
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        {/* Left column */}
        <div className="space-y-3.5">
          <ConfidenceIndicator level={triage.confidence} score={triage.confidenceScore} />

          {triage.gate ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-100">
                <ShieldAlert size={16} className="text-red-600" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-red-700">Safety gate activated</div>
                <div className="mt-0.5 text-xs text-red-700">{triage.gate.text}</div>
                <div className="mt-1 text-[11px] text-red-600/80">
                  Deterministic red-flag rule — this cannot be lowered by the risk score.
                </div>
              </div>
            </div>
          ) : triage.escalated ? (
            <div className="overflow-hidden rounded-xl border border-amber-200">
              <div className="flex items-start gap-2.5 bg-amber-50 p-3.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <ShieldCheck size={16} className="text-amber-600" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-amber-800">Safety floor applied</div>
                  <div className="mt-0.5 text-xs text-amber-800">
                    AI recommendation cannot downgrade a critical safety finding.
                  </div>
                </div>
              </div>
              <WhySection triage={triage} />
            </div>
          ) : triage.confidence === "Medium" ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <CircleAlert size={16} className="text-amber-600" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-amber-800">Uncertain signals</div>
                <div className="mt-0.5 text-xs text-amber-800">
                  Some inputs conflict or are missing — monitor closely and re-check on wait.
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={17} /> Assessment consistent — no safety override needed
            </div>
          )}

          {isP1 && (
            <div className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-3 text-sm font-extrabold text-white shadow-md">
              ⚡ IMMEDIATE — move to resuscitation now
            </div>
          )}
          {isP2 && (
            <div className="rounded-xl border border-orange-300 bg-gradient-to-r from-orange-50 to-orange-100 px-4 py-3 text-sm font-bold text-orange-700">
              ⚠ HIGH RISK — next available physician, continuous monitoring
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div>
            <div className="panel-title mb-2">Key contributing factors</div>
            <ul className="space-y-1.5">
              {triage.factors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-clinical-700">
                  {f.type === "up" ? (
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-red-100">
                      <ArrowUp size={11} className="text-red-600" />
                    </span>
                  ) : f.type === "warn" ? (
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-100">
                      <AlertTriangle size={11} className="text-amber-600" />
                    </span>
                  ) : (
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-clinical-100">
                      <Info size={11} className="text-clinical-400" />
                    </span>
                  )}
                  <span className={f.weight >= 2 ? "font-semibold text-clinical-800" : ""}>{f.label}</span>
                </li>
              ))}
              {triage.factors.length === 0 && <li className="text-xs text-clinical-400">No deviating factors.</li>}
            </ul>
          </div>

          <div>
            <div className="panel-title mb-2">Missing information</div>
            {triage.missingLabels.length ? (
              <div className="flex flex-wrap gap-1.5">
                {triage.missingLabels.map((m) => (
                  <span key={m} className="badge bg-clinical-100 text-clinical-600">{m}</span>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={13} /> Complete intake — all key vitals recorded
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-clinical-50 p-3.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-clinical-100">
              <Stethoscope size={14} className="text-clinical-500" />
            </div>
            <div>
              <div className="panel-title">Recommended next action</div>
              <div className="mt-0.5 text-xs font-semibold text-clinical-800">{meta.nextAction}</div>
            </div>
          </div>
        </div>
      </div>

      {showActions && (
        <div className="flex flex-wrap items-center gap-2 border-t border-clinical-100 bg-clinical-50/80 px-5 py-3.5">
          <span className="mr-auto text-[11px] font-medium text-clinical-500">
            {patientName && `Recommendation for ${patientName} — `}clinician confirmation required
          </span>
          <button onClick={onAccept} className="btn bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-600">
            <CheckCircle2 size={16} /> Accept Recommendation
          </button>
          <button onClick={onOverride} className="btn btn-ghost">
            <AlertTriangle size={16} /> Override
          </button>
        </div>
      )}
    </div>
  );
}
