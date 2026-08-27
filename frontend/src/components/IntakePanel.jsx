import { useRef, useState } from "react";
import {
  ScanSearch, Loader2, Sparkles, Route, CheckCircle2, ClipboardList,
  User, Heart, Stethoscope,
} from "lucide-react";
import { useStore } from "../store";
import TriageCard from "./TriageCard";
import OverrideModal from "./OverrideModal";
import EsiBadge from "./EsiBadge";

const OBSERVED_OPTIONS = [
  { code: "bleeding", label: "Active bleeding" },
  { code: "respDistress", label: "Respiratory distress" },
  { code: "altered", label: "Altered mental status" },
  { code: "chestPainDiaphoresis", label: "Chest pain w/ diaphoresis" },
  { code: "lethargy", label: "Lethargy" },
  { code: "petechiae", label: "Petechial rash" },
  { code: "limp", label: "Limping / guarding" },
];

const COMORBIDITIES = [
  { code: "diabetes", label: "Diabetes" },
  { code: "htn", label: "Hypertension" },
  { code: "copd", label: "COPD" },
  { code: "anticoag", label: "Anticoagulant" },
  { code: "cardiac", label: "Cardiac history" },
  { code: "dementia", label: "Dementia" },
];

const ROUTE_STYLE = {
  emergency: "bg-red-600 text-white",
  urgent: "bg-amber-500 text-white",
  specialty: "bg-blue-600 text-white",
  routine: "bg-emerald-600 text-white",
  general: "bg-slate-600 text-white",
};

const PRESETS = [
  {
    label: "Chest pain (ED)",
    complaint: "Severe chest pain for 20 minutes with sweating and shortness of breath.",
    vitals: { hr: 112, sbp: 100, rr: 24, spo2: 94, temp: 37.0 },
    pain: 8,
    observed: ["chestPainDiaphoresis"],
    comorb: ["cardiac", "htn"],
    record: true,
    age: 61,
    dot: "bg-red-500",
  },
  {
    label: "Dandruff (routine)",
    complaint: "My scalp has dandruff and mild itching for two months",
    vitals: { hr: 74, sbp: 118, rr: 16, spo2: 99, temp: 36.6 },
    pain: 0,
    observed: [],
    comorb: [],
    record: false,
    age: 41,
    dot: "bg-green-500",
  },
  {
    label: "Pediatric fever",
    complaint: "Fever and reduced responsiveness",
    vitals: { hr: 148, sbp: 92, rr: 34, spo2: 93, temp: 39.8 },
    pain: 6,
    observed: ["lethargy"],
    comorb: [],
    record: false,
    age: 3,
    dot: "bg-orange-500",
  },
  {
    label: "Zero-history abdo pain",
    complaint: "Abdominal pain, new patient to this ED",
    vitals: { hr: 102, sbp: 118, rr: 18, spo2: 97, temp: 37.4 },
    pain: 6,
    observed: [],
    comorb: [],
    record: false,
    age: 29,
    dot: "bg-amber-400",
  },
  {
    label: "Back pain (incomplete vitals)",
    complaint: "Severe lower back pain after lifting at work",
    vitals: { hr: "", sbp: "", rr: 16, spo2: "", temp: "" },
    pain: 5,
    observed: [],
    comorb: [],
    record: false,
    age: 39,
    dot: "bg-blue-500",
  },
];

const emptyVitals = { hr: "", sbp: "", rr: "", spo2: "", temp: "" };

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-clinical-400">
      <Icon size={12} />
      {children}
    </div>
  );
}

export default function IntakePanel() {
  const { analyzePatient, commitIntake, hospital } = useStore();

  const [age, setAge] = useState("");
  const [sex, setSex] = useState("F");
  const [complaint, setComplaint] = useState("");
  const [vitals, setVitals] = useState(emptyVitals);
  const [pain, setPain] = useState("");
  const [observed, setObserved] = useState([]);
  const [hasRecord, setHasRecord] = useState(false);
  const [comorb, setComorb] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [committed, setCommitted] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const pendingId = useRef(null);

  const fillPreset = (p) => {
    setAge(String(p.age));
    setComplaint(p.complaint);
    setVitals({ ...emptyVitals, ...p.vitals });
    setPain(String(p.pain));
    setObserved(p.observed);
    setComorb(p.comorb);
    setHasRecord(p.record);
    setResult(null);
    setCommitted(false);
  };

  const toggleObserved = (c) =>
    setObserved((o) => (o.includes(c) ? o.filter((x) => x !== c) : [...o, c]));
  const toggleComorb = (c) =>
    setComorb((o) => (o.includes(c) ? o.filter((x) => x !== c) : [...o, c]));

  const num = (v) => (v === "" || v == null ? null : Number(v));
  const setV = (k) => (e) => setVitals((v) => ({ ...v, [k]: e.target.value }));

  const canAnalyze = complaint.trim().length >= 10 && age !== "";

  const analyze = async () => {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setCommitted(false);
    setResult(null);
    const started = performance.now();
    const res = await analyzePatient({
      complaint: complaint.trim(),
      age: Number(age),
      sex,
      vitals: {
        hr: num(vitals.hr), sbp: num(vitals.sbp), dbp: null,
        rr: num(vitals.rr), spo2: num(vitals.spo2), temp: num(vitals.temp), gcs: 15,
      },
      painScore: num(pain),
      extraObserved: observed,
      history: { hasRecord, comorbidities: comorb },
    });
    pendingId.current = res.backendId ?? null;
    const elapsed = performance.now() - started;
    setTimeout(() => {
      setResult(res);
      setAnalyzing(false);
    }, Math.max(0, 900 - elapsed));
  };

  const buildIntake = (decision) => ({
    name: "New Patient", age: Number(age), sex, complaint: complaint.trim(),
    vitals: {
      hr: num(vitals.hr), sbp: num(vitals.sbp), dbp: null,
      rr: num(vitals.rr), spo2: num(vitals.spo2), temp: num(vitals.temp), gcs: 15,
    },
    painScore: num(pain), extraObserved: observed,
    history: { hasRecord, comorbidities: comorb },
    features: result.features, observed: result.observed,
    routing: result.routing, triage: result.triage,
    backendId: pendingId.current,
    decision,
  });

  const clearForm = () => {
    setResult(null);
    pendingId.current = null;
    setComplaint("");
    setVitals(emptyVitals);
    setPain("");
  };

  const acceptIntake = async () => {
    await commitIntake(buildIntake({ kind: "accept", level: result.triage.esi, clinician: "RN (on shift)" }));
    setCommitted(true);
    clearForm();
  };

  const overrideIntake = async ({ level, reason, notes, clinician }) => {
    await commitIntake(buildIntake({ kind: "override", level, reason, notes, clinician }));
    setCommitted(true);
    clearForm();
  };

  const routeAway = async () => {
    await commitIntake(buildIntake(null));
    setCommitted(true);
    clearForm();
  };

  const routeMeta = result?.routing ? ROUTE_STYLE[result.routing.level] : null;

  // Count filled fields for progress
  const filledCount = [
    age !== "",
    complaint.trim().length >= 10,
    vitals.hr !== "",
    vitals.sbp !== "",
    vitals.rr !== "",
    vitals.spo2 !== "",
    vitals.temp !== "",
    pain !== "",
  ].filter(Boolean).length;
  const totalFields = 8;

  return (
    <div className="panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinical-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinical-100 text-clinical-600">
            <ClipboardList size={16} />
          </div>
          <div>
            <div className="text-sm font-extrabold text-clinical-900">New Patient Intake</div>
            <div className="text-[11px] text-clinical-500">Front-door assessment &amp; routing — {hospital.name}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => fillPreset(p)} className="badge border border-clinical-200 bg-clinical-50 text-clinical-600 transition-all hover:border-clinical-400 hover:bg-white hover:text-clinical-800 hover:shadow-sm">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${p.dot}`} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        {/* ---------------------------------------------------------- form */}
        <div className="border-b border-clinical-100 p-5 lg:border-b-0 lg:border-r">
          {/* Progress indicator */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-clinical-100">
              <div
                className="h-full rounded-full bg-clinical-600 transition-all duration-500"
                style={{ width: `${(filledCount / totalFields) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-clinical-400">{filledCount}/{totalFields} fields</span>
          </div>

          {/* Demographics */}
          <SectionLabel icon={User}>Demographics</SectionLabel>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="i-age">Age</label>
              <input id="i-age" type="number" min="0" max="120" className="input" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 61" />
            </div>
            <div>
              <label className="label" htmlFor="i-sex">Sex</label>
              <select id="i-sex" className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="F">Female</option>
                <option value="M">Male</option>
                <option value="X">Other / unknown</option>
              </select>
            </div>
            <div>
              <label className="label">Patient ID</label>
              <input className="input bg-clinical-50 text-clinical-400" value="Auto-assigned" readOnly disabled />
            </div>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="i-complaint">Chief complaint / free-text symptoms</label>
            <textarea
              id="i-complaint"
              rows={3}
              className="input resize-none"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="e.g. Severe chest pain for 20 minutes with sweating and shortness of breath."
            />
          </div>

          {/* Vitals */}
          <div className="mt-5">
            <SectionLabel icon={Heart}>Vitals</SectionLabel>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {[
              ["spo2", "SpO₂ (%)"], ["hr", "HR (bpm)"], ["rr", "RR (/min)"],
              ["sbp", "SBP (mmHg)"], ["temp", "Temp (°C)"],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="label" htmlFor={`i-${k}`}>{label}</label>
                <input id={`i-${k}`} type="number" className="input" value={vitals[k]} onChange={setV(k)} placeholder="—" />
              </div>
            ))}
          </div>

          <div className="mt-3">
            <label className="label" htmlFor="i-pain">Self-reported pain (0–10)</label>
            <input id="i-pain" type="number" min="0" max="10" className="input" value={pain} onChange={(e) => setPain(e.target.value)} placeholder="e.g. 8" />
          </div>

          {/* Clinical observations */}
          <div className="mt-5">
            <SectionLabel icon={Stethoscope}>Clinical observations</SectionLabel>
          </div>
          <div className="mt-2">
            <div className="label">Observed cues</div>
            <div className="flex flex-wrap gap-1.5">
              {OBSERVED_OPTIONS.map((o) => (
                <button
                  key={o.code}
                  onClick={() => toggleObserved(o.code)}
                  className={`badge border transition-all ${observed.includes(o.code) ? "border-clinical-700 bg-clinical-900 text-white shadow-sm" : "border-clinical-200 bg-white text-clinical-600 hover:border-clinical-400 hover:shadow-sm"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-clinical-700">
              <input type="checkbox" checked={hasRecord} onChange={(e) => setHasRecord(e.target.checked)} className="h-4 w-4 rounded accent-clinical-900" />
              Previous hospital record on file
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMORBIDITIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => toggleComorb(c.code)}
                  className={`badge border transition-all ${comorb.includes(c.code) ? "border-clinical-700 bg-clinical-900 text-white shadow-sm" : "border-clinical-200 bg-white text-clinical-600 hover:border-clinical-400 hover:shadow-sm"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={analyze} disabled={!canAnalyze || analyzing} className="btn btn-primary mt-5 w-full py-2.5">
            {analyzing ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Extracting clinical features…
              </>
            ) : (
              <>
                <ScanSearch size={17} /> Analyze Patient
              </>
            )}
          </button>
          {!canAnalyze && (
            <p className="mt-2 text-center text-[11px] text-clinical-400">Enter an age and a complaint of at least 10 characters to analyze.</p>
          )}
        </div>

        {/* -------------------------------------------------------- result */}
        <div className="min-h-[420px] bg-clinical-50/40 p-5">
          {analyzing && (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-clinical-300 bg-white p-8 text-center">
              <div className="relative">
                <Loader2 size={32} className="animate-spin text-clinical-400" />
                <span className="absolute inset-0 animate-ping rounded-full bg-clinical-200 opacity-30" />
              </div>
              <div>
                <div className="text-sm font-bold text-clinical-700">Extracting clinical features…</div>
                <div className="mt-1 max-w-xs text-xs text-clinical-500">
                  Simulated Clinical NLP layer is structuring the free-text complaint (body site, symptoms, severity, onset). No triage decision is made here.
                </div>
              </div>
            </div>
          )}

          {committed && !result && !analyzing && (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center animate-fadeInUp">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-base font-bold text-emerald-800">Patient added to the queue</div>
                <div className="mt-1 text-xs text-emerald-700">
                  The recommendation was recorded with the clinician's decision in the audit trail.
                </div>
              </div>
            </div>
          )}

          {!result && !analyzing && !committed && (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-clinical-200 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-clinical-100">
                <Sparkles size={24} className="text-clinical-400" />
              </div>
              <div className="text-sm font-semibold text-clinical-500">Awaiting intake</div>
              <div className="max-w-xs text-xs text-clinical-400">
                Enter a complaint and press Analyze. The system will extract features, route the patient, and — if Emergency — run ESI triage.
              </div>
            </div>
          )}

          {result && !committed && (
            <div className="space-y-3 animate-fadeInUp">
              {/* NLP structured output */}
              <div className="rounded-xl border border-clinical-200 bg-white p-4 shadow-sm">
                <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-clinical-500">
                  <Sparkles size={13} /> Clinical NLP — structured extraction
                </div>
                <div className="font-mono text-[11px] leading-relaxed text-clinical-700">
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-clinical-50 p-3">
{`{
  body_site: "${result.features.bodySite ?? "general"}",
  symptoms: [${result.features.symptoms.map((s) => `"${s}"`).join(", ")}],
  severity: "${result.features.severity}",
  onset: "${result.features.onset}",
  bleeding: ${result.features.bleeding}
}`}
                  </pre>
                </div>
                <div className="mt-2 text-[11px] text-clinical-400">
                  Extraction only — the NLP layer does not make the triage decision.
                </div>
              </div>

              {/* Routing result */}
              <div className="rounded-xl border border-clinical-200 bg-white p-4 shadow-sm">
                <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-clinical-500">
                  <Route size={13} /> Routing decision
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge px-2.5 py-1 text-sm font-extrabold shadow-sm ${routeMeta}`}>
                    {result.routing.pathwayName}
                  </span>
                  {result.routing.needsTriage && <EsiBadge level={result.triage.esi} size="sm" />}
                </div>
                <div className="mt-2 text-xs font-medium text-clinical-700">{result.routing.reason}</div>
                {!result.routing.needsTriage ? (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={14} /> Emergency triage: Not required
                  </div>
                ) : (
                  <div className="mt-2.5 rounded-lg bg-clinical-50 px-3 py-2 text-xs font-semibold text-clinical-600">
                    Patient enters the Emergency pathway → ESI triage below.
                  </div>
                )}
                {!result.routing.needsTriage && (
                  <button
                    onClick={routeAway}
                    className="btn mt-3 w-full border-emerald-300 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Route size={15} /> Route to {result.routing.pathwayName}
                  </button>
                )}
              </div>

              {/* Triage card */}
              {result.routing.needsTriage && result.triage && (
                <TriageCard
                  triage={result.triage}
                  patientName="New Patient"
                  onAccept={acceptIntake}
                  onOverride={() => setOverrideOpen(true)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <OverrideModal
        open={overrideOpen}
        patientName="New Patient"
        aiEsi={result?.triage?.esi ?? 3}
        onClose={() => setOverrideOpen(false)}
        onSubmit={overrideIntake}
      />
    </div>
  );
}
