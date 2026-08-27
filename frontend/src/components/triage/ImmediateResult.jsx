/**
 * ImmediateResult.jsx — Shown when the user selects YES on the immediacy check.
 *
 * No form, no ML model. Just a clear, urgent emergency directive.
 */
import { AlertTriangle, RotateCcw, Shield, Phone } from "lucide-react";

export default function ImmediateResult({ onNewPatient }) {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Pulsing warning icon */}
        <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-red-200 opacity-60" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-300">
            <AlertTriangle size={36} className="text-white" />
          </div>
        </div>

        {/* Alert heading */}
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-8 text-center shadow-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-sm font-bold text-white">
            <Shield size={14} />
            IMMEDIATE TREATMENT REQUIRED
          </div>

          <h2 className="text-2xl font-extrabold text-red-800">
            Send for Immediate Clinical Evaluation
          </h2>
          <p className="mt-3 text-sm text-red-700 leading-relaxed">
            This patient has been identified as <strong>extremely or critically serious</strong>.
            Do not delay. Clinical evaluation and treatment must begin immediately.
          </p>

          {/* What to do */}
          <div className="mt-6 space-y-2 text-left">
            {[
              "Alert the emergency team immediately",
              "Do not administer further screening questions",
              "Ensure immediate clinical evaluation is initiated",
              "Document the reason as: IMMEDIATE_CRITICAL",
            ].map((action, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-white px-4 py-2 shadow-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700">{action}</p>
              </div>
            ))}
          </div>

          {/* ML bypass notice */}
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-3">
            <Shield size={14} className="shrink-0 text-red-500" />
            <p className="text-xs text-red-700 text-left">
              <strong>Safety enforced:</strong> The AI/ML model was NOT consulted.
              This decision was recorded as <code className="font-mono text-red-600">IMMEDIATE_CRITICAL</code>.
              The backend enforces this — it cannot be bypassed by the frontend.
            </p>
          </div>
        </div>

        {/* New patient */}
        <button
          id="btn-new-patient-immediate"
          onClick={onNewPatient}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white py-4 text-sm font-bold text-gray-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
        >
          <RotateCcw size={16} />
          New Patient Triage
        </button>

        <p className="mt-4 text-center text-[11px] text-gray-400">
          ⚠️ This is a decision-support prototype. Clinical judgment must prevail.
        </p>
      </div>
    </div>
  );
}
