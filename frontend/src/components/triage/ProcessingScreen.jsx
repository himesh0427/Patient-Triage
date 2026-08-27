/**
 * ProcessingScreen.jsx — Animated processing screen shown while backend runs.
 *
 * Shows which stage is currently active:
 *   Stage 1 ✓ → Stage 2 (Rules) → Stage 3 (ML)
 */
import { Shield, Brain, CheckCircle2 } from "lucide-react";

const STAGES = [
  {
    id: "rules",
    icon: Shield,
    label: "Safety Rules Check",
    sub: "Age-aware vital sign thresholds",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  {
    id: "ml",
    icon: Brain,
    label: "ML Model Assessment",
    sub: "LightGBM prediction (if rules pass)",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
];

export default function ProcessingScreen() {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        {/* Spinner */}
        <div className="relative mx-auto mb-8 h-24 w-24">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600" />
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-blue-50">
            <Shield size={28} className="text-blue-600" />
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-gray-800">
          Assessing Patient…
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Running the safety-first triage pipeline
        </p>

        {/* Stage indicators */}
        <div className="mt-8 space-y-3">
          {/* Stage 1 — always "done" by this point */}
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-left">
            <CheckCircle2 size={20} className="shrink-0 text-green-500" />
            <div>
              <p className="text-sm font-semibold text-green-800">Stage 1 — Immediate Seriousness Check</p>
              <p className="text-xs text-green-600">Patient is not immediately critical — proceeding</p>
            </div>
          </div>

          {STAGES.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className={`flex items-center gap-3 rounded-xl border ${stage.border} ${stage.bg} px-4 py-3 text-left`}
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                <div className="shrink-0">
                  <Icon size={20} className={`${stage.color} animate-pulse`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${stage.color.replace("600", "800")}`}>
                    Stage {i + 2} — {stage.label}
                  </p>
                  <p className={`text-xs ${stage.color}`}>{stage.sub}</p>
                </div>
                {/* Running indicator */}
                <div className="ml-auto flex gap-0.5">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className={`h-1.5 w-1.5 rounded-full ${stage.bg.replace("50", "200")} animate-bounce`}
                      style={{ animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-gray-400">
          The backend enforces all safety rules — the AI model is never called for critical patients.
        </p>
      </div>
    </div>
  );
}
