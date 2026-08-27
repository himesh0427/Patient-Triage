import { api } from "./src/lib/api.js";
import { extractClinicalFeatures } from "./src/lib/nlp.js";
import { decidePathway } from "./src/lib/routing.js";
import { ageGroupOf, ESI_META } from "./src/lib/esi.js";
import { HOSPITALS } from "./src/data/hospitals.js";

await api.reset();

// 1) Queue mapping sanity — every patient must map cleanly
const queue = await api.queue();
console.log("queue length:", queue.length);
if (queue.length < 10) throw new Error("queue too small");

for (const p of queue) {
  const f = extractClinicalFeatures(p.complaint, p.vitals);
  const routing = decidePathway({
    complaint: p.complaint, features: f, vitals: p.vitals,
    painScore: p.pain_score, ageGroup: ageGroupOf(p.age),
    hospital: HOSPITALS.urban, observedSymptoms: p.observed_symptoms,
  });
  if (routing.needsTriage !== true) throw new Error(`${p.name} should be in the ED queue`);
  if (p.triage.severity < 1 || p.triage.severity > 5) throw new Error("bad severity");
  if (!ESI_META[p.triage.severity]) throw new Error("missing ESI meta");
  if (!p.triage.confidence) throw new Error("missing confidence");
}

// 2) Create via API with staggered arrival
const created = await api.createPatient({
  name: "Test Chest", age: 55, sex: "M",
  complaint: "Severe chest pain and shortness of breath",
  complaint_tag: "cardiac",
  vitals: { hr: 118, sbp: 102, dbp: 70, rr: 26, spo2: 91, temp: 37.2, gcs: 15 },
  pain_score: 8,
  observed_symptoms: [],
  history: { has_record: true, comorbidities: ["cardiac"] },
  arrived_at: new Date(Date.now() - 25 * 60000).toISOString(),
});
console.log("created:", created.id, "esi", created.triage.severity, "status", created.status);
if (created.status !== "queued") throw new Error("expected queued on intake");

// 3) Accept
const accepted = await api.accept(created.id, "RN T. Osei");
if (accepted.clinician_decision.kind !== "accept") throw new Error("accept failed");

// 4) Override
const overridden = await api.override(created.id, { level: 2, reason: "Clinical observation: persistent diaphoresis and clamminess", clinician: "RN K. Alvarez" });
if (overridden.clinician_decision.level !== 2 || overridden.clinician_decision.kind !== "override") throw new Error("override failed");

// 5) Reassess -> deterioration
const re = await api.reassess(created.id, { vitals: { hr: 132, sbp: 96, dbp: 60, rr: 30, spo2: 86, temp: 38.7, gcs: 15 }, pain_score: 7 });
if (!re.deteriorated) throw new Error("expected deterioration flag");
if (re.triage.severity !== 1) throw new Error("expected escalation to ESI 1, got " + re.triage.severity);

// 6) Discharge
const d = await api.discharge(created.id);
if (d.status !== "discharged") throw new Error("discharge failed");

// 7) Audit trail reflects the full lifecycle
const audit = await api.audit();
const mine = audit.filter((a) => a.patient_id === created.id);
console.log("audit entries for test patient:", mine.map((a) => a.action).join(" → "));
if (!mine.some((a) => a.action === "clinician_override")) throw new Error("missing override audit entry");

// 8) Mode toggle
await api.setMode("surge");
await api.setMode("normal");

console.log("\nALL BACKEND INTEGRATION CHECKS PASSED ✓");
