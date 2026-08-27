/**
 * PatientAssessmentForm.jsx — Screen 2: Patient Data Collection Form
 *
 * Multi-section form with:
 *  - Patient demographics (age, sex)
 *  - Vital signs with unit labels
 *  - Chief complaint + symptom tags
 *  - Frontend validation with clear error messages
 *
 * Design principles:
 *  - Fields are clearly optional vs. important
 *  - Missing vitals are NOT defaulted — the backend treats them as missing (NaN)
 *  - Clear unit labels prevent input errors
 */
import { useState } from "react";
import {
  User, Heart, Wind, Thermometer, Droplets, Activity,
  ChevronRight, AlertCircle, Info, Plus
} from "lucide-react";
import { checkHardGates, ageGroupOf } from "../../lib/esi";

const SEX_OPTIONS = [
  { value: "F", label: "Female" },
  { value: "M", label: "Male" },
  { value: "X", label: "Other / Unknown" },
];


const COMPLAINT_TAGS = [
  { value: "general", label: "General / Other" },
  { value: "cardiac", label: "Cardiac" },
  { value: "respiratory", label: "Respiratory" },
  { value: "trauma", label: "Trauma / Injury" },
  { value: "neuro", label: "Neurological" },
  { value: "infection", label: "Infection / Fever" },
];

const SYMPTOM_OPTIONS = [
  { value: "altered", label: "Altered mental status" },
  { value: "respDistress", label: "Respiratory distress" },
  { value: "lethargy", label: "Lethargy / reduced responsiveness" },
  { value: "petechiae", label: "Petechiae / non-blanching rash" },
  { value: "chestPainDiaphoresis", label: "Chest pain + sweating" },
  { value: "bleeding", label: "Active bleeding" },
  { value: "nausea", label: "Nausea / vomiting" },
  { value: "limp", label: "Limb injury / unable to weight-bear" },
];

function VitalInput({ id, label, unit, min, max, step = "1", value, onChange, icon: Icon, hint }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {Icon && <Icon size={12} />}
        {label}
        <span className="ml-auto text-[10px] font-normal normal-case text-gray-400">Optional</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="—"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-14 text-sm text-gray-900 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
          {unit}
        </span>
      </div>
      {hint && (
        <p className="flex items-center gap-1 text-[10px] text-gray-400">
          <Info size={9} /> {hint}
        </p>
      )}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, accent = "blue" }) {
  const accents = {
    blue: "border-blue-200 bg-blue-50/30",
    green: "border-emerald-200 bg-emerald-50/20",
    purple: "border-purple-200 bg-purple-50/20",
    orange: "border-orange-200 bg-orange-50/20",
  };
  return (
    <div className={`rounded-xl border ${accents[accent]} p-5`}>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-600">
        <Icon size={14} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500">
      <AlertCircle size={11} />
      {msg}
    </p>
  );
}

export default function PatientAssessmentForm({ onSubmit, isLoading }) {
  const [form, setForm] = useState({
    age: "",
    sex: "X",
    hr: "",
    sbp: "",
    dbp: "",
    rr: "",
    spo2: "",
    temp: "",
    painScore: "",
    complaint: "",
    complaintTag: "general",
    symptoms: [],
  });

  const [errors, setErrors] = useState({});
  const [showSymptoms, setShowSymptoms] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }

  function toggleSymptom(val) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(val)
        ? f.symptoms.filter((s) => s !== val)
        : [...f.symptoms, val],
    }));
  }

  function validate() {
    const errs = {};
    const age = Number(form.age);
    if (!form.age && form.age !== 0) errs.age = "Age is required.";
    else if (isNaN(age) || age < 0 || age > 120) errs.age = "Age must be between 0 and 120 years.";

    if (form.spo2 !== "" && (Number(form.spo2) < 0 || Number(form.spo2) > 100))
      errs.spo2 = "SpO₂ must be between 0 and 100%.";
    if (form.hr !== "" && (Number(form.hr) < 0 || Number(form.hr) > 400))
      errs.hr = "Heart rate must be between 0 and 400 bpm.";
    if (form.sbp !== "" && (Number(form.sbp) < 0 || Number(form.sbp) > 350))
      errs.sbp = "Systolic BP must be between 0 and 350 mmHg.";
    if (form.temp !== "" && (Number(form.temp) < 25 || Number(form.temp) > 47))
      errs.temp = "Temperature must be between 25°C and 47°C.";

    return errs;
  }

  function handleCheckVitals() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const vitals = {};
    if (form.hr !== "") vitals.hr = Number(form.hr);
    if (form.sbp !== "") vitals.sbp = Number(form.sbp);
    if (form.dbp !== "") vitals.dbp = Number(form.dbp);
    if (form.rr !== "") vitals.rr = Number(form.rr);
    if (form.spo2 !== "") vitals.spo2 = Number(form.spo2);
    if (form.temp !== "") vitals.temp = Number(form.temp);

    const ageGroup = ageGroupOf(Number(form.age));
    const gate = checkHardGates(vitals, [], ageGroup);

    if (gate && gate.level === 1) {
      // Extremely serious, bypass model & symptoms
      onSubmit({
        age: Number(form.age),
        sex: form.sex,
        vitals: Object.keys(vitals).length > 0 ? vitals : undefined,
        complaint: undefined,
        complaintTag: "general",
        symptoms: [],
        painScore: form.painScore !== "" ? Number(form.painScore) : undefined,
      });
    } else {
      setShowSymptoms(true);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const vitals = {};
    if (form.hr !== "") vitals.hr = Number(form.hr);
    if (form.sbp !== "") vitals.sbp = Number(form.sbp);
    if (form.dbp !== "") vitals.dbp = Number(form.dbp);
    if (form.rr !== "") vitals.rr = Number(form.rr);
    if (form.spo2 !== "") vitals.spo2 = Number(form.spo2);
    if (form.temp !== "") vitals.temp = Number(form.temp);
    if (form.painScore !== "") vitals.pain_score = Number(form.painScore);

    onSubmit({
      age: Number(form.age),
      sex: form.sex,
      vitals: Object.keys(vitals).length > 0 ? vitals : undefined,
      complaint: form.complaint || undefined,
      complaintTag: form.complaintTag,
      symptoms: form.symptoms,
      painScore: form.painScore !== "" ? Number(form.painScore) : undefined,
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Stage label */}
      <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-gray-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">2</span>
        Stage 2 — Patient Assessment
        <span className="ml-2 text-xs font-normal text-gray-400">
          Provide as many measurements as available. Missing values are honoured — never assumed normal.
        </span>
      </div>

      <form id="patient-assessment-form" onSubmit={handleSubmit} className="space-y-5" noValidate>

        {/* Demographics */}
        <SectionCard title="Patient Demographics" icon={User} accent="blue">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="pt-age" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Age (years) <span className="text-red-500">*</span>
              </label>
              <input
                id="pt-age"
                type="number"
                min={0}
                max={120}
                value={form.age}
                onChange={(e) => update("age", e.target.value)}
                placeholder="e.g. 45"
                className={`w-full rounded-lg border ${errors.age ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50"} py-2.5 px-3 text-sm text-gray-900 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100`}
              />
              <FieldError msg={errors.age} />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">Sex</label>
              <div className="flex gap-2">
                {SEX_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    id={`sex-${opt.value}`}
                    onClick={() => update("sex", opt.value)}
                    className={`flex-1 rounded-lg border py-2.5 text-xs font-semibold transition ${form.sex === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Vital Signs */}
        <SectionCard title="Vital Signs" icon={Heart} accent="green">
          <p className="mb-4 flex items-center gap-1.5 text-[11px] text-gray-400">
            <Info size={11} />
            All vitals are optional. Missing values are forwarded to the backend as missing (not imputed to normal values).
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <VitalInput id="pt-spo2" label="SpO₂" unit="%" min={50} max={100} step="0.1"
              value={form.spo2} onChange={(v) => update("spo2", v)} icon={Droplets}
              hint="Oxygen saturation" />
            <VitalInput id="pt-hr" label="Heart Rate" unit="bpm" min={0} max={400}
              value={form.hr} onChange={(v) => update("hr", v)} icon={Heart}
              hint="Beats per minute" />
            <VitalInput id="pt-rr" label="Resp Rate" unit="/min" min={0} max={100}
              value={form.rr} onChange={(v) => update("rr", v)} icon={Wind}
              hint="Breaths per minute" />
            <VitalInput id="pt-sbp" label="Systolic BP" unit="mmHg" min={0} max={350}
              value={form.sbp} onChange={(v) => update("sbp", v)} icon={Activity} />
            <VitalInput id="pt-dbp" label="Diastolic BP" unit="mmHg" min={0} max={250}
              value={form.dbp} onChange={(v) => update("dbp", v)} icon={Activity} />
            <VitalInput id="pt-temp" label="Temperature" unit="°C" min={25} max={47} step="0.1"
              value={form.temp} onChange={(v) => update("temp", v)} icon={Thermometer} />
          </div>

          <FieldError msg={errors.spo2 || errors.hr || errors.sbp || errors.temp} />

          {/* pain */}
          <div className="mt-4 space-y-1">
            <label htmlFor="pt-pain-score" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Pain Severity (1-5)
            </label>
            <select
              id="pt-pain-score"
              value={form.painScore}
              onChange={(e) => update("painScore", e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm text-gray-900 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">None / Not Assessed</option>
              <option value="1">1 - Minimal</option>
              <option value="2">2 - Low</option>
              <option value="3">3 - Moderate</option>
              <option value="4">4 - High</option>
              <option value="5">5 - Critical / Emergency</option>
            </select>
          </div>
        </SectionCard>

        {/* Symptoms Section - Hidden until vitals are checked */}
        {!showSymptoms ? (
          <button
            type="button"
            onClick={handleCheckVitals}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-orange-500 py-4 text-base font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 hover:shadow-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-200"
          >
            Add Symptoms & Complete <Plus size={20} />
          </button>
        ) : (
          <>
            <SectionCard title="Chief Complaint" icon={AlertCircle} accent="orange">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="pt-complaint-tag" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Complaint Category
              </label>
              <select
                id="pt-complaint-tag"
                value={form.complaintTag}
                onChange={(e) => update("complaintTag", e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {COMPLAINT_TAGS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="pt-complaint" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Free-text Complaint
              </label>
              <textarea
                id="pt-complaint"
                rows={3}
                value={form.complaint}
                onChange={(e) => update("complaint", e.target.value)}
                placeholder="Describe the chief complaint..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm text-gray-900 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Symptom tags */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Observed Symptoms</p>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_OPTIONS.map((s) => {
                const active = form.symptoms.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    id={`sym-${s.value}`}
                    onClick={() => toggleSymptom(s.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active
                        ? "border-red-400 bg-red-50 text-red-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                      }`}
                  >
                    {active ? "✓ " : ""}{s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {/* Submit */}
        <button
          id="btn-assess-submit"
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 hover:shadow-blue-300 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-blue-200"
        >
          {isLoading ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Running triage assessment…
            </>
          ) : (
            <>
              Run Triage Assessment
              <ChevronRight size={20} />
            </>
          )}
        </button>
          </>
        )}

        <p className="text-center text-[11px] text-gray-400">
          ⚠️ Decision-support only. All results require clinician review. Not for diagnosis.
        </p>
      </form>
    </div>
  );
}
