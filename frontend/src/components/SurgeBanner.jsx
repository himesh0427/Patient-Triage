import { AlertTriangle, Activity } from "lucide-react";
import { useStore } from "../store";

export default function SurgeBanner() {
  const { surgeOn, toggleSurge } = useStore();
  if (!surgeOn) return null;
  return (
    <div className="animate-fadeInUp overflow-hidden rounded-xl border border-clinical-700/50 bg-gradient-to-r from-clinical-800 to-clinical-900 px-5 py-4 text-white shadow-lg shadow-clinical-900/20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="text-base font-extrabold tracking-wide">SURGE MODE ACTIVE — 3× simulated volume</div>
            <div className="mt-0.5 text-xs text-clinical-200">
              High-acuity patients are automatically prioritised. Waiting times lengthen; reassessment alerts increase. Medium-confidence recommendations escalate one tier (safety policy).
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge bg-white/15 text-white backdrop-blur-sm">
            <Activity size={12} className="animate-pulseDot" /> Dynamic prioritisation on
          </span>
          <button onClick={toggleSurge} className="btn bg-white px-4 py-2 text-sm font-bold text-clinical-900 shadow-sm hover:bg-clinical-50">
            End surge
          </button>
        </div>
      </div>
    </div>
  );
}
