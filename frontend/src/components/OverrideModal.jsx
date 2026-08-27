import { useEffect, useState } from "react";
import { AlertTriangle, X, ShieldCheck, ArrowRight } from "lucide-react";
import { ESI_META } from "../lib/esi";

const REASONS = [
  "Clinical observation",
  "New information",
  "Patient deterioration",
  "AI recommendation incorrect",
  "Other",
];

export default function OverrideModal({ open, patientName, aiEsi, onClose, onSubmit }) {
  const [level, setLevel] = useState(aiEsi ?? 3);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [clinician, setClinician] = useState("RN (on shift)");

  useEffect(() => {
    if (open) {
      setLevel(aiEsi ?? 3);
      setReason("");
      setNotes("");
      setClinician("RN (on shift)");
    }
  }, [open, aiEsi]);

  if (!open) return null;

  const valid = level >= 1 && level <= 5;
  const changed = level !== aiEsi;

  const submit = () => {
    if (!valid) return;
    onSubmit({ level, reason, notes, clinician });
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Override AI recommendation">
      <div className="modal-panel">
        <div className="flex items-center justify-between border-b border-clinical-100 bg-clinical-50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div>
              <div className="text-base font-extrabold text-clinical-900">Override AI recommendation</div>
              <div className="text-xs text-clinical-500">
                {patientName} · AI recommended <strong>ESI {aiEsi}</strong> ({ESI_META[aiEsi]?.label})
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-clinical-400 transition-colors hover:bg-clinical-100 hover:text-clinical-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Visual comparison */}
          {changed && (
            <div className="flex items-center justify-center gap-3 rounded-xl bg-clinical-50 px-4 py-3 animate-fadeIn">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase text-clinical-400">AI Says</div>
                <div className={`mt-1 text-2xl font-black ${ESI_META[aiEsi]?.text ?? "text-clinical-700"}`}>P{aiEsi}</div>
              </div>
              <ArrowRight size={20} className="text-clinical-400" />
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase text-clinical-400">Your Decision</div>
                <div className={`mt-1 text-2xl font-black ${ESI_META[level]?.text ?? "text-clinical-700"}`}>P{level}</div>
              </div>
            </div>
          )}

          <div>
            <div className="label">New ESI level</div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((l) => {
                const m = ESI_META[l];
                const active = level === l;
                return (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`flex flex-col items-center rounded-xl border-2 px-2 py-2.5 transition-all ${
                      active ? `${m.border} ${m.softBg} ${m.text} shadow-sm` : "border-clinical-200 bg-white text-clinical-500 hover:border-clinical-300 hover:bg-clinical-50"
                    }`}
                    aria-pressed={active}
                  >
                    <span className="text-xl font-black">P{l}</span>
                    <span className="mt-0.5 text-center text-[9px] font-semibold uppercase leading-tight">{m.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="label">Reason (Optional, recorded in audit trail)</div>
            <div className="grid gap-1.5">
              {REASONS.map((r) => (
                <label key={r} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition-all ${reason === r ? "border-clinical-700 bg-clinical-50 font-semibold text-clinical-900 shadow-sm" : "border-clinical-200 text-clinical-600 hover:bg-clinical-50 hover:border-clinical-300"}`}>
                  <input type="radio" name="override-reason" className="accent-clinical-900" checked={reason === r} onChange={() => setReason(reason === r ? "" : r)} onClick={() => setReason(reason === r ? "" : r)} />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="notes">Optional notes</label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. SpO₂ improved after oxygen, family reports different history…"
              className="input resize-none"
            />
          </div>

          <div>
            <label className="label" htmlFor="clinician">Clinician</label>
            <input id="clinician" value={clinician} onChange={(e) => setClinician(e.target.value)} className="input" />
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-clinical-200 bg-clinical-50 p-3.5 text-xs text-clinical-600">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            The final clinical decision is yours. This override and its reason are written to the immutable audit trail for accountability and compliance.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-clinical-100 bg-clinical-50 px-5 py-3.5">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={submit} disabled={!valid} className="btn bg-amber-600 text-white shadow-sm hover:bg-amber-700 focus-visible:ring-amber-600">
            Confirm override → ESI {level}
          </button>
        </div>
      </div>
    </div>
  );
}
