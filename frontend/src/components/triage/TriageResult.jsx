/**
 * TriageResult.jsx — Result screen with full explainability.
 *
 * Shows:
 *  - Visual decision path (which stage made the decision)
 *  - ESI level and clinical meaning
 *  - Whether ML was called or bypassed (and why)
 *  - Triggered rule details
 *  - Missing features list
 *  - Clinical disclaimer
 *  - New Patient button to restart
 */
import {
  AlertTriangle, AlertCircle, CheckCircle2, Activity, Shield, Brain,
  Info, ChevronRight, RotateCcw, XCircle,
} from "lucide-react";

/* -----------------------------------------------------------------------
 * ESI level configuration
 * ----------------------------------------------------------------------- */
const ESI_CONFIG = {
  1: { label: "Immediate", color: "red", badge: "bg-red-600 text-white", text: "text-red-700", border: "border-red-300 bg-red-50" },
  2: { label: "Emergent", color: "orange", badge: "bg-orange-500 text-white", text: "text-orange-700", border: "border-orange-300 bg-orange-50" },
  3: { label: "Urgent", color: "yellow", badge: "bg-yellow-400 text-gray-900", text: "text-yellow-700", border: "border-yellow-300 bg-yellow-50" },
  4: { label: "Less Urgent", color: "green", badge: "bg-green-500 text-white", text: "text-green-700", border: "border-green-300 bg-green-50" },
  5: { label: "Non-Urgent", color: "blue", badge: "bg-blue-500 text-white", text: "text-blue-700", border: "border-blue-300 bg-blue-50" },
};

/* -----------------------------------------------------------------------
 * Status configuration
 * ----------------------------------------------------------------------- */
function getStatusConfig(result) {
  switch (result.decision) {
    case "IMMEDIATE_TREATMENT":
      return {
        heading: "Immediate Treatment Required",
        sub: "Patient is extremely/critically serious — clinical evaluation must begin immediately.",
        icon: AlertTriangle,
        headerBg: "from-red-600 to-red-700",
        headerText: "text-red-100",
        badge: "bg-red-900 text-red-100",
        badgeLabel: "IMMEDIATE",
        chipColor: "bg-red-100 text-red-700",
      };
    case "CRITICAL_ESCALATION":
      return {
        heading: "Critical Escalation",
        sub: "Critical vital sign abnormality detected — immediate clinical evaluation required.",
        icon: AlertTriangle,
        headerBg: "from-red-500 to-red-600",
        headerText: "text-red-100",
        badge: "bg-red-900 text-red-100",
        badgeLabel: "CRITICAL",
        chipColor: "bg-red-100 text-red-700",
      };
    case "URGENT_ESCALATION":
      return {
        heading: "Urgent Escalation",
        sub: "Urgent vital sign abnormality — prompt clinical evaluation required.",
        icon: AlertCircle,
        headerBg: "from-orange-500 to-orange-600",
        headerText: "text-orange-100",
        badge: "bg-orange-900 text-orange-100",
        badgeLabel: "URGENT",
        chipColor: "bg-orange-100 text-orange-700",
      };
    case "MODEL_PREDICTION":
      return {
        heading: `ESI Level ${result.esi_level} — ${result.prediction}`,
        sub: "AI-assisted triage assessment. Review and accept or override before acting.",
        icon: CheckCircle2,
        headerBg: result.esi_level <= 2 ? "from-orange-500 to-amber-600" : result.esi_level === 3 ? "from-yellow-500 to-amber-500" : "from-emerald-500 to-green-600",
        headerText: result.esi_level <= 2 ? "text-orange-100" : "text-green-50",
        badge: result.esi_level ? ESI_CONFIG[result.esi_level]?.badge : "bg-gray-200 text-gray-700",
        badgeLabel: result.prediction,
        chipColor: "bg-blue-100 text-blue-700",
      };
    case "INSUFFICIENT_DATA":
      return {
        heading: "Insufficient Data",
        sub: "Not enough vital signs to safely complete triage. Obtain additional measurements or escalate.",
        icon: XCircle,
        headerBg: "from-gray-500 to-gray-600",
        headerText: "text-gray-100",
        badge: "bg-gray-700 text-gray-100",
        badgeLabel: "INSUFFICIENT DATA",
        chipColor: "bg-gray-100 text-gray-600",
      };
    case "MODEL_FAILED":
      return {
        heading: "Model Assessment Failed",
        sub: "The AI model could not generate a prediction. Clinical review is required.",
        icon: AlertCircle,
        headerBg: "from-gray-500 to-gray-600",
        headerText: "text-gray-100",
        badge: "bg-gray-700 text-gray-100",
        badgeLabel: "MODEL FAILED",
        chipColor: "bg-gray-100 text-gray-600",
      };
    default:
      return {
        heading: "Triage Complete",
        sub: "",
        icon: CheckCircle2,
        headerBg: "from-gray-500 to-gray-600",
        headerText: "text-gray-100",
        badge: "bg-gray-600 text-white",
        badgeLabel: result.decision,
        chipColor: "bg-gray-100 text-gray-600",
      };
  }
}

/* -----------------------------------------------------------------------
 * Decision Path Diagram
 * ----------------------------------------------------------------------- */
function DecisionPath({ result }) {
  const steps = [
    {
      id: "immediate",
      label: "Immediate Check",
      sub: result.immediate_critical ? "FLAGGED — bypassed all" : "Passed",
      done: true,
      critical: result.immediate_critical,
      icon: AlertTriangle,
    },
    {
      id: "rules",
      label: "Safety Rules",
      sub: result.stage === "immediate_check"
        ? "Skipped (immediate critical)"
        : result.triggered_rules?.length > 0
        ? `${result.triggered_rules.length} rule(s) triggered`
        : result.stage === "rule_based" ? "Decision made here" : "Passed",
      done: result.stage !== "immediate_check",
      critical: result.stage === "rule_based" && result.decision !== "PROCEED_TO_MODEL",
      active: result.stage === "rule_based",
      icon: Shield,
    },
    {
      id: "ml",
      label: "ML Model",
      sub: result.model_called
        ? `ESI ${result.esi_level} — ${result.prediction}`
        : result.stage === "ml" && result.decision === "MODEL_FAILED"
        ? "Failed — see below"
        : "Not called (bypassed)",
      done: result.model_called || (result.stage === "ml"),
      critical: result.stage === "ml" && result.decision === "MODEL_FAILED",
      active: result.stage === "ml",
      icon: Brain,
    },
  ];

  return (
    <div className="mb-6 flex items-center gap-1">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex flex-1 items-center">
            <div className={`flex-1 rounded-lg border px-3 py-2.5 text-center transition ${
              step.critical
                ? "border-red-300 bg-red-50"
                : step.active && !step.critical
                ? "border-emerald-300 bg-emerald-50"
                : step.done
                ? "border-gray-200 bg-gray-50"
                : "border-gray-100 bg-gray-50 opacity-50"
            }`}>
              <Icon
                size={14}
                className={`mx-auto mb-1 ${
                  step.critical ? "text-red-600" : step.active ? "text-emerald-600" : "text-gray-400"
                }`}
              />
              <p className="text-[10px] font-bold text-gray-700">{step.label}</p>
              <p className={`text-[9px] ${step.critical ? "text-red-600" : "text-gray-400"}`}>{step.sub}</p>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={14} className="shrink-0 text-gray-300 mx-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -----------------------------------------------------------------------
 * Triggered Rules display
 * ----------------------------------------------------------------------- */
function TriggeredRules({ rules }) {
  if (!rules || rules.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
        <Shield size={12} /> Triggered Clinical Rules
      </h4>
      {rules.map((rule, i) => (
        <div
          key={`${rule.rule_id}-${i}`}
          className={`rounded-lg border ${
            rule.severity === "CRITICAL"
              ? "border-red-200 bg-red-50"
              : "border-amber-200 bg-amber-50"
          } px-4 py-3`}
        >
          <div className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
              rule.severity === "CRITICAL" ? "bg-red-600 text-white" : "bg-amber-500 text-white"
            }`}>
              {rule.severity}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-700">{rule.rule_id.replace(/_/g, " ")}</p>
              <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">{rule.message}</p>
              {rule.value !== null && rule.value !== undefined && (
                <p className="mt-1 text-[10px] text-gray-400">
                  Measured: <strong>{typeof rule.value === 'number' ? rule.value.toFixed(rule.vital === 'temp' ? 1 : rule.vital === 'spo2' ? 1 : 0) : rule.value}</strong>
                  {rule.threshold !== null && rule.threshold !== undefined && (
                    <> · Threshold: <strong>{typeof rule.threshold === 'number' ? rule.threshold.toFixed(rule.vital === 'temp' ? 1 : 0) : rule.threshold}</strong></>
                  )}
                  · Age group: <strong>{rule.age_group}</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -----------------------------------------------------------------------
 * ML Probability display
 * ----------------------------------------------------------------------- */
function ProbabilityBar({ level, prob, isMax }) {
  const config = ESI_CONFIG[level] || {};
  const barColors = {
    1: "bg-red-500",
    2: "bg-orange-500",
    3: "bg-yellow-400",
    4: "bg-green-500",
    5: "bg-blue-500",
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${isMax ? "bg-gray-50 ring-1 ring-gray-200" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold ${isMax ? "text-gray-800" : "text-gray-500"}`}>
          ESI {level} — {config.label || "Unknown"}
        </span>
        <span className={`text-xs font-bold ${isMax ? "text-gray-900" : "text-gray-400"}`}>
          {(prob * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColors[level] || "bg-gray-400"}`}
          style={{ width: `${prob * 100}%` }}
        />
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
 * Main TriageResult component
 * ----------------------------------------------------------------------- */
export default function TriageResult({ result, onNewPatient }) {
  const config = getStatusConfig(result);
  const Icon = config.icon;

  const classProbs = result.class_probabilities
    ? Object.entries(result.class_probabilities).map(([k, v]) => ({ level: parseInt(k), prob: v }))
    : null;

  const missingFeatures = (result.missing_features || []).filter(
    (f) => !["age", "sex_encoded", "age_group_encoded", "complaint_tag_encoded"].includes(f)
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header card */}
      <div className={`overflow-hidden rounded-2xl bg-gradient-to-r ${config.headerBg} shadow-xl mb-5`}>
        <div className="px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Icon size={24} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${config.badge}`}>
                  {config.badgeLabel}
                </span>
                {result.age_group && (
                  <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white">
                    {result.age_group}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-xl font-extrabold text-white leading-tight">
                {config.heading}
              </h2>
              <p className={`mt-1 text-sm ${config.headerText}`}>
                {config.sub}
              </p>
            </div>
          </div>

          {/* Model called / bypassed indicator */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              result.model_called
                ? "bg-white/20 text-white"
                : "bg-white/10 text-white/80"
            }`}>
              <Brain size={11} />
              ML Model: {result.model_called ? `Called (v${result.model_version || "—"})` : "Not called"}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              <Shield size={11} />
              Stage: {result.stage.replace("_", " ")}
            </span>
            {result.probability !== null && result.probability !== undefined && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                <Activity size={11} />
                Confidence: {(result.probability * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Decision path diagram */}
      <DecisionPath result={result} />

      {/* Reason */}
      {result.reason && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
            <Info size={12} /> Triage Reasoning
          </h4>
          <p className="text-sm text-gray-700 leading-relaxed">{result.reason}</p>
        </div>
      )}

      {/* Triggered rules */}
      {result.triggered_rules?.length > 0 && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <TriggeredRules rules={result.triggered_rules} />
        </div>
      )}

      {/* ML Probability bars */}
      {classProbs && result.decision === "MODEL_PREDICTION" && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
            <Brain size={12} /> Model Class Probabilities (ESI 1–5)
          </h4>
          <div className="space-y-1.5">
            {classProbs
              .sort((a, b) => a.level - b.level)
              .map(({ level, prob }) => (
                <ProbabilityBar
                  key={level}
                  level={level}
                  prob={prob}
                  isMax={level === result.esi_level}
                />
              ))}
          </div>
          <p className="mt-3 flex items-center gap-1 text-[10px] text-gray-400">
            <Info size={9} />
            Trained on synthetic demo data. Not validated on real patients.
          </p>
        </div>
      )}

      {/* Missing features */}
      {missingFeatures.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
            <Info size={12} /> Missing Clinical Data
          </h4>
          <p className="mb-2 text-xs text-amber-700">
            The following vital signs were not provided and were treated as missing (not assumed normal):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingFeatures.map((f) => (
              <span key={f} className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-xs font-medium text-amber-700">
                {f}
              </span>
            ))}
          </div>
          {result.decision === "INSUFFICIENT_DATA" && (
            <p className="mt-2 text-xs text-amber-700 font-medium">
              Insufficient data to run the ML model. Obtain missing measurements or escalate to clinical review.
            </p>
          )}
        </div>
      )}

      {/* Clinical disclaimer */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          <strong>⚠️ Clinical Disclaimer:</strong> This is a decision-support prototype.
          It does not diagnose patients and does not replace clinical judgment.
          Every recommendation requires clinician review (accept or override) before any clinical action.
          The ML model is trained on synthetic data only and must not be used for real clinical decisions.
        </p>
      </div>

      {/* New patient button */}
      <button
        id="btn-new-patient"
        onClick={onNewPatient}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white py-4 text-sm font-bold text-gray-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
      >
        <RotateCcw size={16} />
        New Patient Triage
      </button>
    </div>
  );
}
