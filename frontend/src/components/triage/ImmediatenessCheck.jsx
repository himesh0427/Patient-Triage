/**
 * ImmediatenessCheck.jsx — Screen 1: Immediate Seriousness Check
 *
 * First screen in the triage flow. Asks one critical question:
 * "Is the patient extremely/critically serious right now?"
 *
 * YES → Immediate emergency state, no form shown
 * NO  → Advances to patient assessment form
 *
 * Safety note: This frontend choice is purely UX. The backend ALWAYS enforces
 * the same logic — if immediate_critical=True, the ML model is never called.
 */
import { AlertTriangle, CheckCircle2, ShieldAlert, Activity } from "lucide-react";

export default function ImmediatenessCheck({ onYes, onNo }) {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center p-6">
      {/* Header badge */}
      <div className="mb-8 flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
        <ShieldAlert size={16} />
        Stage 1 — Immediate Seriousness Check
      </div>

      {/* Main card */}
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        {/* Pulsing red header band */}
        <div className="relative overflow-hidden bg-gradient-to-r from-red-600 to-red-700 p-8 text-center text-white">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2">
            <div className="h-32 w-32 rounded-full bg-red-500 opacity-20 blur-3xl" />
          </div>
          <Activity size={40} className="mx-auto mb-3 animate-pulse" />
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            Patient Seriousness Assessment
          </h1>
          <p className="mt-2 text-red-100 text-sm">
            Answer this question first — it determines the next step
          </p>
        </div>

        {/* Question */}
        <div className="px-8 py-10 text-center">
          <p className="text-xl font-bold text-gray-800 md:text-2xl leading-snug">
            Is the patient{" "}
            <span className="text-red-600">extremely or critically serious</span>{" "}
            right now?
          </p>
          <p className="mt-3 text-sm text-gray-500 max-w-md mx-auto">
            This includes patients who appear unresponsive, are in obvious respiratory
            distress, are actively seizing, or show signs of imminent death.
          </p>

          {/* YES / NO buttons */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            {/* YES — triggers immediate escalation */}
            <button
              id="btn-immediate-yes"
              onClick={onYes}
              className="group flex items-center justify-center gap-3 rounded-xl bg-red-600 px-10 py-5 text-lg font-bold text-white shadow-lg shadow-red-200 transition-all hover:scale-[1.03] hover:bg-red-700 hover:shadow-red-300 focus:outline-none focus:ring-4 focus:ring-red-300"
            >
              <AlertTriangle size={22} className="group-hover:animate-bounce" />
              YES — Critical
            </button>

            {/* NO — advances to assessment */}
            <button
              id="btn-immediate-no"
              onClick={onNo}
              className="group flex items-center justify-center gap-3 rounded-xl border-2 border-emerald-500 bg-white px-10 py-5 text-lg font-bold text-emerald-700 shadow-sm transition-all hover:scale-[1.03] hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-200"
            >
              <CheckCircle2 size={22} />
              NO — Continue Assessment
            </button>
          </div>
        </div>

        {/* Footer note */}
        <div className="border-t border-gray-100 bg-gray-50 px-8 py-4 text-center text-xs text-gray-400">
          <strong>Clinical note:</strong> If in doubt, select YES. Immediate escalation
          is always the safer choice. This screen enforces backend-side safety — the AI
          model is never consulted for an immediately critical patient.
        </div>
      </div>
    </div>
  );
}
