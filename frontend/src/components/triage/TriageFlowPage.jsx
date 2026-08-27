/**
 * TriageFlowPage.jsx — Orchestrates the complete triage flow.
 *
 * Screen states:
 *   SCREEN_TYPE_SELECT    → PatientTypeSelect (new screen 0: Existing / New patient)
 *   SCREEN_IMMEDIATE      → ImmediatenessCheck (Stage 1 YES/NO — skipped if existing+serious)
 *   SCREEN_ASSESSMENT     → PatientAssessmentForm (Stage 2 vitals form)
 *   SCREEN_PROCESSING     → ProcessingScreen (animated while API runs)
 *   SCREEN_RESULT         → TriageResult (shows outcome)
 *   SCREEN_IMMEDIATE_RESULT → ImmediateResult (critical fast-track)
 *
 * The backend ALWAYS enforces safety rules. Frontend state is just UX.
 */
import { useState, useCallback, useEffect } from "react";
import { Stethoscope, AlertTriangle } from "lucide-react";
import PatientTypeSelect from "./PatientTypeSelect";
import ImmediatenessCheck from "./ImmediatenessCheck";
import ImmediateResult from "./ImmediateResult";
import PatientAssessmentForm from "./PatientAssessmentForm";
import ProcessingScreen from "./ProcessingScreen";
import TriageResult from "./TriageResult";
import { assessPatient } from "../../lib/triageApi";

const SCREEN_TYPE_SELECT    = "type_select";
const SCREEN_IMMEDIATE      = "immediate";
const SCREEN_ASSESSMENT     = "assessment";
const SCREEN_PROCESSING     = "processing";
const SCREEN_RESULT         = "result";
const SCREEN_IMMEDIATE_RESULT = "immediate_result";
const SCREEN_ERROR          = "error";

function ProgressBar({ screen }) {
  const steps = [
    { id: SCREEN_TYPE_SELECT, label: "Patient Type" },
    { id: SCREEN_IMMEDIATE,   label: "Stage 1" },
    { id: SCREEN_ASSESSMENT,  label: "Stage 2" },
    { id: SCREEN_PROCESSING,  label: "Processing" },
    { id: SCREEN_RESULT,      label: "Result" },
  ];
  const activeIndex = steps.findIndex((s) => s.id === screen);

  return (
    <div className="mb-8 flex items-center gap-0">
      {steps.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <div key={step.id} className="flex flex-1 items-center">
            <div className="flex-1">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  isDone ? "bg-blue-500" : isActive ? "bg-blue-300" : "bg-gray-200"
                }`}
              />
              <p className={`mt-1 text-center text-[10px] font-semibold ${
                isActive ? "text-blue-600" : isDone ? "text-gray-500" : "text-gray-300"
              }`}>
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TriageFlowPage() {
  const [screen, setScreenRaw] = useState(SCREEN_TYPE_SELECT);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [patientContext, setPatientContext] = useState(null);

  // Push browser history on every screen change so "Back" works
  const setScreen = useCallback((newScreen) => {
    setScreenRaw(newScreen);
    window.history.pushState({ triageScreen: newScreen }, "", "");
  }, []);

  // Listen for browser back/forward
  useEffect(() => {
    // Push initial state so we always have something in the stack
    window.history.replaceState({ triageScreen: SCREEN_TYPE_SELECT }, "", "");

    const onPopState = (e) => {
      if (e.state?.triageScreen) {
        setScreenRaw(e.state.triageScreen);
      } else {
        // No triage state → go to the initial screen (don't leave the site)
        setScreenRaw(SCREEN_TYPE_SELECT);
        // Push a fresh entry so another "back" won't exit
        window.history.pushState({ triageScreen: SCREEN_TYPE_SELECT }, "", "");
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const reset = useCallback(() => {
    setScreenRaw(SCREEN_TYPE_SELECT);
    setResult(null);
    setError(null);
    setIsLoading(false);
    setPatientContext(null);
    window.history.pushState({ triageScreen: SCREEN_TYPE_SELECT }, "", "");
  }, []);

  /* --- Screen 0: Patient type selected --- */
  const handleTypeSelected = useCallback(async (ctx) => {
    setPatientContext(ctx);

    if (ctx.type === "existing" && ctx.serious) {
      // Existing + Critical → immediately fast-track, skip all stages
      setScreen(SCREEN_PROCESSING);
      setIsLoading(true);
      try {
        const res = await assessPatient({ immediateCritical: true });
        setResult(res);
        setScreen(SCREEN_IMMEDIATE_RESULT);
      } catch {
        setResult({
          decision: "IMMEDIATE_TREATMENT",
          stage: "immediate_check",
          model_called: false,
          immediate_critical: true,
          reason: "Existing patient flagged as critically serious — immediate treatment required.",
          triggered_rules: [],
          missing_features: [],
        });
        setScreen(SCREEN_IMMEDIATE_RESULT);
      } finally {
        setIsLoading(false);
      }
    } else {
      // New patient or existing non-critical → go through normal flow
      setScreen(SCREEN_IMMEDIATE);
    }
  }, []);

  /* --- Stage 1: User said YES (critically serious) --- */
  const handleImmediateCritical = useCallback(async () => {
    setScreen(SCREEN_PROCESSING);
    setIsLoading(true);
    try {
      const res = await assessPatient({ immediateCritical: true });
      setResult(res);
      setScreen(SCREEN_IMMEDIATE_RESULT);
    } catch {
      setResult({
        decision: "IMMEDIATE_TREATMENT",
        stage: "immediate_check",
        model_called: false,
        immediate_critical: true,
        reason: "Patient is critically serious — immediate treatment required. (Note: backend could not be reached to confirm.)",
        triggered_rules: [],
        missing_features: [],
      });
      setScreen(SCREEN_IMMEDIATE_RESULT);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* --- Stage 1: User said NO — show form --- */
  const handleNotCritical = useCallback(() => {
    setScreen(SCREEN_ASSESSMENT);
  }, []);

  /* --- Stage 2: Form submitted — run full assessment --- */
  const handleFormSubmit = useCallback(async (formData) => {
    setScreen(SCREEN_PROCESSING);
    setIsLoading(true);
    setError(null);

    try {
      const res = await assessPatient({
        immediateCritical: false,
        ...formData,
      });
      setResult(res);
      setScreen(SCREEN_RESULT);
    } catch (err) {
      setError(err.message || "An error occurred while contacting the triage server.");
      setScreen(SCREEN_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case SCREEN_TYPE_SELECT:
        return <PatientTypeSelect onSelect={handleTypeSelected} />;
      case SCREEN_IMMEDIATE:
        return <ImmediatenessCheck onYes={handleImmediateCritical} onNo={handleNotCritical} />;
      case SCREEN_ASSESSMENT:
        return <PatientAssessmentForm onSubmit={handleFormSubmit} isLoading={isLoading} patientContext={patientContext} />;
      case SCREEN_PROCESSING:
        return <ProcessingScreen />;
      case SCREEN_RESULT:
        return result ? <TriageResult result={result} onNewPatient={reset} /> : null;
      case SCREEN_IMMEDIATE_RESULT:
        return <ImmediateResult onNewPatient={reset} />;
      case SCREEN_ERROR:
        return (
          <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border-2 border-red-200 bg-red-50 p-8 text-center">
              <AlertTriangle size={40} className="mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-bold text-red-800">Connection Error</h3>
              <p className="mt-2 text-sm text-red-700 leading-relaxed">{error}</p>
              <p className="mt-3 text-xs text-red-600">
                If the backend is unavailable, please escalate to clinical review directly.
              </p>
              <button
                id="btn-retry-after-error"
                onClick={reset}
                className="mt-6 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[80vh]">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900 lg:text-2xl">
            <Stethoscope size={22} className="text-blue-600" />
            Patient Triage Assessment
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Safety-first AI-assisted triage — immediate check → rules → ML
          </p>
        </div>
        {screen !== SCREEN_TYPE_SELECT && (
          <button
            id="btn-restart-triage"
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
          >
            ↩ Restart Triage
          </button>
        )}
      </div>

      {/* Progress bar */}
      {screen !== SCREEN_IMMEDIATE_RESULT && screen !== SCREEN_ERROR && (
        <ProgressBar screen={screen} />
      )}

      {/* Screen content */}
      <div key={screen} className="animate-fadeIn">
        {renderScreen()}
      </div>

      {/* Patient context badge — show assigned ID when in assessment */}
      {patientContext?.patientId && screen === SCREEN_ASSESSMENT && (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <span className="font-mono font-bold tracking-widest text-blue-600">{patientContext.patientId}</span>
          <span>· New patient — ID assigned</span>
        </div>
      )}
      {patientContext?.mrn && screen === SCREEN_ASSESSMENT && (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <span className="font-mono font-bold tracking-widest text-purple-600">{patientContext.mrn}</span>
          <span>· Existing patient</span>
        </div>
      )}
    </div>
  );
}
