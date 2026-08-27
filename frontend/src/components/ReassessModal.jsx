import { useEffect, useState } from "react";
import { X, Activity, Zap } from "lucide-react";
import { useStore } from "../store";
import { ESI_META } from "../lib/esi";
import EsiBadge from "./EsiBadge";

export default function ReassessModal({ open, patient, onClose }) {
  const { reassess, currentLevel } = useStore();
  const [vitals, setVitals] = useState({});

  useEffect(() => {
    if (open && patient) {
      setVitals({
        hr: patient.vitals.hr ?? "",
        sbp: patient.vitals.sbp ?? "",
        rr: patient.vitals.rr ?? "",
        spo2: patient.vitals.spo2 ?? "",
        temp: patient.vitals.temp ?? "",
        pain: patient.painScore ?? "",
      });
    }
  }, [open, patient]);

  if (!open || !patient) return null;

  const set = (k) => (e) => setVitals((v) => ({ ...v, [k]: e.target.value }));

  const simulateDeterioration = () => {
    setVitals({
      hr: (patient.vitals.hr ?? 90) + 25,
      sbp: patient.vitals.sbp ?? "",
      rr: (patient.vitals.rr ?? 18) + 9,
      spo2: Math.max(85, (patient.vitals.spo2 ?? 98) - 6),
      temp: patient.vitals.temp ?? "",
      pain: Math.min(10, (patient.painScore ?? 4) + 1),
    });
  };

  const num = (v) => (v === "" || v == null ? null : Number(v));

  const submit = () => {
    reassess(patient.id, {
      hr: num(vitals.hr),
      sbp: num(vitals.sbp),
      dbp: patient.vitals.dbp ?? null,
      rr: num(vitals.rr),
      spo2: num(vitals.spo2),
      temp: num(vitals.temp),
      gcs: patient.vitals.gcs ?? 15,
    }, num(vitals.pain));
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Re-check vitals">
      <div className="modal-panel">
        <div className="flex items-center justify-between border-b border-clinical-100 bg-clinical-50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinical-100">
              <Activity size={16} className="text-clinical-600" />
            </div>
            <div>
              <div className="text-base font-extrabold text-clinical-900">Waiting-room vitals re-check</div>
              <div className="flex items-center gap-1.5 text-xs text-clinical-500">
                {patient.name} · current level <EsiBadge level={currentLevel(patient)} size="sm" />
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-clinical-400 transition-colors hover:bg-clinical-100 hover:text-clinical-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <button
            onClick={simulateDeterioration}
            className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 text-left text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <Zap size={14} className="text-amber-600" />
            </div>
            <span>Simulate deterioration — fill worsening vitals (SpO₂ ↓, HR ↑, RR ↑)</span>
          </button>

          <div className="grid grid-cols-3 gap-3">
            {[
              ["hr", "Heart rate", "bpm"],
              ["spo2", "SpO₂", "%"],
              ["rr", "Resp rate", "/min"],
              ["sbp", "Systolic BP", "mmHg"],
              ["temp", "Temp", "°C"],
              ["pain", "Pain score", "0-10"],
            ].map(([k, label, unit]) => (
              <div key={k}>
                <label className="label" htmlFor={`v-${k}`}>{label}</label>
                <div className="relative">
                  <input
                    id={`v-${k}`}
                    type="number"
                    className="input pr-12"
                    value={vitals[k]}
                    onChange={set(k)}
                    min={k === "pain" ? 0 : undefined}
                    max={k === "pain" ? 10 : undefined}
                    step={k === "temp" ? 0.1 : undefined}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-clinical-400">
                    {unit}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-clinical-200 bg-clinical-50 p-3.5 text-xs text-clinical-600">
            <Activity size={15} className="mt-0.5 shrink-0 text-clinical-500" />
            The engine re-runs triage on the new vitals. If the tier escalates toward more urgent, the system flags
            DETERIORATION DETECTED and requests a new clinician review.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-clinical-100 bg-clinical-50 px-5 py-3.5">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={submit} className="btn btn-primary">Run re-check</button>
        </div>
      </div>
    </div>
  );
}
