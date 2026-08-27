/**
 * PatientTypeSelect.jsx — Screen 0: Patient Type Selection
 *
 * Before any clinical assessment, the nurse selects:
 *   - Existing patient (has prior record — may also be flagged as critical immediately)
 *   - New patient    (first visit — system assigns a unique Patient ID)
 */
import { useState } from "react";
import { UserCheck, UserPlus, AlertTriangle, CopyCheck, ChevronRight, Hash } from "lucide-react";

function generatePatientId() {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const day = String(new Date().getDate()).padStart(2, "0");
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `PT-${year}${month}${day}-${rand}`;
}

export default function PatientTypeSelect({ onSelect }) {
  const [choice, setChoice] = useState(null); // "existing" | "new"
  const [existingSeriousness, setExistingSeriousness] = useState(null); // "serious" | "normal"
  const [mrn, setMrn] = useState("");
  const [generatedId] = useState(generatePatientId);
  const [copied, setCopied] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(generatedId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const proceed = () => {
    if (choice === "existing" && existingSeriousness === "serious") {
      onSelect({ type: "existing", serious: true, mrn: mrn || null, patientId: null });
    } else if (choice === "existing" && existingSeriousness === "normal") {
      onSelect({ type: "existing", serious: false, mrn: mrn || null, patientId: null });
    } else if (choice === "new") {
      onSelect({ type: "new", serious: false, mrn: null, patientId: generatedId });
    }
  };

  const canProceed =
    (choice === "new") ||
    (choice === "existing" && existingSeriousness !== null);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
          <UserPlus size={26} className="text-white" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Add Patient</h2>
        <p className="mt-1.5 text-sm text-gray-500">
          Select whether this is an existing patient or a new arrival.
        </p>
      </div>

      {/* Choice cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Existing patient */}
        <button
          type="button"
          id="pt-type-existing"
          onClick={() => { setChoice("existing"); setExistingSeriousness(null); }}
          className={`group flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all duration-200 ${
            choice === "existing"
              ? "border-purple-500 bg-purple-50 shadow-md shadow-purple-100"
              : "border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm"
          }`}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
            choice === "existing" ? "bg-purple-600" : "bg-gray-100 group-hover:bg-purple-100"
          }`}>
            <UserCheck size={20} className={choice === "existing" ? "text-white" : "text-gray-500 group-hover:text-purple-600"} />
          </div>
          <div>
            <div className="text-base font-extrabold text-gray-900">Existing Patient</div>
            <div className="mt-0.5 text-xs text-gray-500">Patient has prior records in this system</div>
          </div>
        </button>

        {/* New patient */}
        <button
          type="button"
          id="pt-type-new"
          onClick={() => { setChoice("new"); setExistingSeriousness(null); }}
          className={`group flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all duration-200 ${
            choice === "new"
              ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
              : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
          }`}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
            choice === "new" ? "bg-blue-600" : "bg-gray-100 group-hover:bg-blue-100"
          }`}>
            <UserPlus size={20} className={choice === "new" ? "text-white" : "text-gray-500 group-hover:text-blue-600"} />
          </div>
          <div>
            <div className="text-base font-extrabold text-gray-900">New Patient</div>
            <div className="mt-0.5 text-xs text-gray-500">First visit — system will assign a unique Patient ID</div>
          </div>
        </button>
      </div>

      {/* Existing patient — seriousness sub-choice */}
      {choice === "existing" && (
        <div className="mt-5 animate-fadeIn rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Is this patient <span className="text-red-600">extremely or critically serious</span> right now?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              id="pt-existing-serious"
              onClick={() => setExistingSeriousness("serious")}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left font-bold transition-all ${
                existingSeriousness === "serious"
                  ? "border-red-500 bg-red-600 text-white shadow-md shadow-red-200"
                  : "border-red-200 bg-white text-red-700 hover:border-red-400 hover:bg-red-50"
              }`}
            >
              <AlertTriangle size={18} />
              YES — Critical
            </button>
            <button
              type="button"
              id="pt-existing-normal"
              onClick={() => setExistingSeriousness("normal")}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left font-bold transition-all ${
                existingSeriousness === "normal"
                  ? "border-green-500 bg-green-600 text-white shadow-md shadow-green-200"
                  : "border-green-200 bg-white text-green-700 hover:border-green-400 hover:bg-green-50"
              }`}
            >
              <ChevronRight size={18} />
              NO — Assess Normally
            </button>
          </div>

          {/* Optional MRN lookup */}
          <div className="space-y-1.5 pt-1">
            <label htmlFor="pt-mrn" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              MRN / Patient ID (optional)
            </label>
            <input
              id="pt-mrn"
              type="text"
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              placeholder="e.g. PT-240827-12345"
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 placeholder:text-gray-300"
            />
          </div>
        </div>
      )}

      {/* New patient — show generated ID */}
      {choice === "new" && (
        <div className="mt-5 animate-fadeIn rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Hash size={14} className="text-blue-600" />
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">System-assigned Patient ID</p>
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded-lg border border-blue-200 bg-white px-4 py-3 font-mono text-base font-bold tracking-widest text-blue-800 shadow-sm">
              {generatedId}
            </code>
            <button
              type="button"
              onClick={copyId}
              title="Copy to clipboard"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
                copied
                  ? "border-green-300 bg-green-100 text-green-700"
                  : "border-blue-200 bg-white text-blue-600 hover:bg-blue-100"
              }`}
            >
              <CopyCheck size={18} />
            </button>
          </div>
          <p className="mt-2.5 text-[11px] text-blue-600">
            Note this ID — it will be associated with all triage records and audit entries for this patient.
          </p>
        </div>
      )}

      {/* Proceed button */}
      {canProceed && (
        <button
          type="button"
          id="btn-patient-type-proceed"
          onClick={proceed}
          className={`mt-6 flex w-full animate-fadeIn items-center justify-center gap-3 rounded-xl py-4 text-base font-bold text-white shadow-lg transition hover:shadow-xl focus:outline-none focus:ring-4 ${
            choice === "existing" && existingSeriousness === "serious"
              ? "bg-red-600 shadow-red-200 hover:bg-red-700 focus:ring-red-200"
              : "bg-blue-600 shadow-blue-200 hover:bg-blue-700 focus:ring-blue-200"
          }`}
        >
          {choice === "existing" && existingSeriousness === "serious"
            ? <><AlertTriangle size={20} /> Proceed to Immediate Assessment</>
            : <><ChevronRight size={20} /> Continue to Triage</>
          }
        </button>
      )}
    </div>
  );
}
