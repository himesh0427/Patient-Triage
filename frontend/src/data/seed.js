import { HOSPITALS } from "./hospitals";
import { extractClinicalFeatures } from "../lib/nlp";
import { decidePathway } from "../lib/routing";
import { computeTriage, ageGroupOf } from "../lib/esi";

let idCounter = 0;
const newId = () => `P${String(++idCounter).padStart(3, "0")}`;
const newMrn = () => `MRN-${Math.floor(100000 + Math.random() * 800000)}`;
const newAuditId = () => `AUD-${Math.floor(1000 + Math.random() * 9000)}`;

function buildPatient(spec, hospitalId, now) {
  const {
    name, age, sex, complaint, vitals, painScore,
    extraObserved = [], history = { hasRecord: false, comorbidities: [] },
    minutesAgo, mode = "normal", status = "queued",
  } = spec;

  const arrivedAt = new Date(now - minutesAgo * 60000);
  const features = extractClinicalFeatures(complaint, vitals);
  const observedSymptoms = [...new Set([...features.observedSymptoms, ...extraObserved])];
  const hospital = HOSPITALS[hospitalId];
  const routing = decidePathway({
    complaint, features, vitals, painScore,
    ageGroup: ageGroupOf(age), hospital,
    observedSymptoms,
  });
  const triage = routing.needsTriage
    ? computeTriage({
        age, vitals, painScore, observedSymptoms,
        hasHistoryRecord: history.hasRecord,
        comorbidities: history.comorbidities,
        complaintTag: features.tag,
        mode,
      })
    : null;

  return {
    id: newId(),
    mrn: newMrn(),
    name, age, sex,
    ageGroup: ageGroupOf(age),
    complaint,
    features,
    vitals: { ...vitals },
    painScore,
    observedSymptoms,
    history: { ...history, comorbidities: [...history.comorbidities] },
    arrivedAt,
    routing,
    triage,
    initialTriage: null,
    clinicianDecision: null,
    status,
    deteriorated: false,
    events: [
      {
        at: arrivedAt,
        type: "arrival",
        detail: "Patient arrived and intake data recorded.",
      },
    ],
    auditId: null,
  };
}

function buildAudit(p, action, overrides = {}) {
  return {
    id: newAuditId(),
    at: overrides.at ?? p.arrivedAt,
    patientId: p.id,
    patientName: p.name,
    action,
    aiEsi: p.triage?.esi ?? null,
    aiConfidence: p.triage?.confidence ?? null,
    finalEsi: overrides.finalEsi ?? p.clinicianDecision?.level ?? p.triage?.esi ?? null,
    overrideReason: overrides.reason ?? p.clinicianDecision?.reason ?? null,
    clinician: overrides.clinician ?? p.clinicianDecision?.clinician ?? "RN (on shift)",
    importantChange: overrides.importantChange ?? null,
    modelVersion: p.triage?.modelVersion ?? "PT-Triage v0.9.2-hackathon",
  };
}

export function createSeedState(hospitalId = "urban") {
  idCounter = 0;
  const now = Date.now();
  const seed = (s) => buildPatient(s, hospitalId, now);

  const patients = [];
  const audit = [];

  // ---------------------------------------------------------------- ED queue
  const p1Samuel = seed({
    name: "Samuel Reyes", age: 51, sex: "M",
    complaint: "Severe abdominal pain, pale and diaphoretic",
    vitals: { hr: 128, sbp: 84, dbp: 52, rr: 26, spo2: 92, temp: 37.0, gcs: 14 },
    painScore: 8, minutesAgo: 2,
  });
  const p2Connor = seed({
    name: "Connor Walsh", age: 33, sex: "M",
    complaint: "Deep laceration to hand, bleeding won't stop",
    vitals: { hr: 122, sbp: 110, dbp: 70, rr: 22, spo2: 96, temp: 37.0, gcs: 15 },
    painScore: 7, minutesAgo: 6,
  });
  const p3Margaret = seed({
    name: "Margaret Sato", age: 74, sex: "F",
    complaint: "Dizziness on standing, near-fall this morning",
    vitals: { hr: 38, sbp: 102, dbp: 64, rr: 16, spo2: 95, temp: 36.5, gcs: 15 },
    painScore: 3,
    history: { hasRecord: true, comorbidities: ["cardiac", "htn"] },
    minutesAgo: 3,
  });
  const p4Tunde = seed({
    name: "Tunde Adeyemi", age: 44, sex: "M",
    complaint: "Wheezing and difficulty breathing, known asthma",
    vitals: { hr: 118, sbp: 128, dbp: 82, rr: 28, spo2: 91, temp: 37.3, gcs: 15 },
    painScore: 5,
    history: { hasRecord: true, comorbidities: ["copd"] },
    minutesAgo: 5,
  });
  const p5Robert = seed({
    name: "Robert Klein", age: 61, sex: "M",
    complaint: "Crushing chest pain radiating to left arm, with sweating",
    vitals: { hr: 112, sbp: 100, dbp: 62, rr: 24, spo2: 94, temp: 37.0, gcs: 15 },
    painScore: 8,
    history: { hasRecord: true, comorbidities: ["cardiac", "htn"] },
    minutesAgo: 14,
  });
  const p6Grace = seed({
    name: "Grace Okafor", age: 58, sex: "F",
    complaint: "Shortness of breath, worsening over 2 days",
    vitals: { hr: 104, sbp: 132, dbp: 84, rr: 22, spo2: 93, temp: 38.1, gcs: 15 },
    painScore: 4,
    history: { hasRecord: true, comorbidities: ["copd"] },
    minutesAgo: 8,
  });
  // Grace deteriorates while waiting: ESI 3 -> ESI 2
  const graceInitialTriage = p6Grace.triage;
  const graceNewVitals = { hr: 115, sbp: 130, dbp: 82, rr: 27, spo2: 91, temp: 38.4, gcs: 15 };
  const graceNewTriage = computeTriage({
    age: 58, vitals: graceNewVitals, painScore: 5,
    observedSymptoms: [],
    hasHistoryRecord: true, comorbidities: ["copd"],
    complaintTag: "respiratory", mode: "normal",
  });
  p6Grace.vitals = { ...graceNewVitals };
  p6Grace.painScore = 5;
  p6Grace.observedSymptoms = [];
  p6Grace.triage = graceNewTriage;
  p6Grace.initialTriage = graceInitialTriage;
  p6Grace.deteriorated = true;
  p6Grace.events.push({
    at: new Date(now - 3 * 60000), type: "reassess-alert",
    detail: "Automatic reassessment: severity escalated L3 → L2 (SpO₂ 91%, RR 27). Clinician review required.",
  });

  const p7Marcus = seed({
    name: "Marcus Ibe", age: 47, sex: "M",
    complaint: "Mild chest discomfort, probably nothing",
    vitals: { hr: 118, sbp: null, dbp: null, rr: 24, spo2: 93, temp: null, gcs: 15 },
    painScore: 2,
    history: { hasRecord: true, comorbidities: ["cardiac"] },
    minutesAgo: 18,
  });
  const p8Aarav = seed({
    name: "Aarav Sharma", age: 3, sex: "M",
    complaint: "Fever and reduced responsiveness",
    vitals: { hr: 148, sbp: 92, dbp: 60, rr: 34, spo2: 93, temp: 39.8, gcs: 14 },
    painScore: 6,
    extraObserved: ["lethargy"],
    minutesAgo: 22,
  });
  const p9Harold = seed({
    name: "Harold Winters", age: 79, sex: "M",
    complaint: "Sudden confusion reported by family",
    vitals: { hr: 92, sbp: 142, dbp: 88, rr: 22, spo2: 95, temp: 38.4, gcs: 12 },
    painScore: null,
    extraObserved: ["altered"],
    history: { hasRecord: true, comorbidities: ["dementia", "htn"] },
    minutesAgo: 35,
  });
  const p10Eleanor = seed({
    name: "Eleanor Voss", age: 82, sex: "F",
    complaint: "Fall at home, hip pain, cannot bear weight",
    vitals: { hr: 112, sbp: 128, dbp: 78, rr: 18, spo2: 95, temp: 36.9, gcs: 15 },
    painScore: 8,
    extraObserved: ["limp"],
    history: { hasRecord: true, comorbidities: ["anticoag", "htn"] },
    minutesAgo: 40,
  });
  // Seed override: AI ESI 3 -> clinician ESI 2
  const overrideAt = new Date(now - 35 * 60000);
  p10Eleanor.clinicianDecision = {
    kind: "override", level: 2,
    reason: "Clinical observation: elderly fall on anticoagulant therapy — high-risk mechanism warrants escalation",
    clinician: "RN K. Alvarez", at: overrideAt,
  };
  const p11Noah = seed({
    name: "Noah Bergström", age: 5, sex: "M",
    complaint: "Fever with petechial rash on legs",
    vitals: { hr: 134, sbp: 96, dbp: 60, rr: 30, spo2: 94, temp: 39.1, gcs: 15 },
    painScore: 4,
    extraObserved: ["petechiae"],
    minutesAgo: 44,
  });
  const p12Priya = seed({
    name: "Priya Natarajan", age: 29, sex: "F",
    complaint: "Abdominal pain, new patient to this ED",
    vitals: { hr: 102, sbp: 118, dbp: 76, rr: 18, spo2: 97, temp: 37.4, gcs: 15 },
    painScore: 6, minutesAgo: 48,
  });
  const p13Diego = seed({
    name: "Diego Fuentes", age: 34, sex: "M",
    complaint: "Twisted ankle playing football, severe pain, cannot bear weight",
    vitals: { hr: 106, sbp: 124, dbp: 78, rr: 18, spo2: 98, temp: 36.8, gcs: 15 },
    painScore: 8,
    extraObserved: ["limp"],
    minutesAgo: 61,
  });
  const p14Nadia = seed({
    name: "Nadia Petrov", age: 26, sex: "F",
    complaint: "Anxious, racing heart, chest tightness, tingling hands",
    vitals: { hr: 102, sbp: 124, dbp: 80, rr: 20, spo2: 99, temp: 36.9, gcs: 15 },
    painScore: 3, minutesAgo: 15,
  });
  const p15Yusuf = seed({
    name: "Yusuf Demir", age: 39, sex: "M",
    complaint: "Severe lower back pain after lifting at work",
    vitals: { hr: null, sbp: null, dbp: null, rr: 16, spo2: null, temp: null, gcs: 15 },
    painScore: 5, minutesAgo: 28,
  });

  const edQueue = [p1Samuel, p2Connor, p3Margaret, p4Tunde, p5Robert, p6Grace, p7Marcus, p8Aarav, p9Harold, p10Eleanor, p11Noah, p12Priya, p13Diego, p14Nadia, p15Yusuf];

  // ------------------------------------------------- routed away (not ED queue)
  const r1Dandruff = seed({
    name: "Oliver Marsh", age: 41, sex: "M",
    complaint: "My scalp has dandruff and mild itching for two months",
    vitals: { hr: 74, sbp: 118, dbp: 74, rr: 16, spo2: 99, temp: 36.6, gcs: 15 },
    painScore: 0,
    minutesAgo: 26,
    status: "routed",
  });
  const r2Doris = seed({
    name: "Doris Mbeki", age: 71, sex: "F",
    complaint: "Routine follow-up for medication refill query",
    vitals: { hr: 78, sbp: 132, dbp: 80, rr: 16, spo2: 93, temp: 36.6, gcs: 15 },
    painScore: 1,
    history: { hasRecord: true, comorbidities: ["copd", "diabetes"] },
    minutesAgo: 21,
    status: "routed",
  });
  const r3Ines = seed({
    name: "Ines Fontana", age: 9, sex: "F",
    complaint: "Sore throat and mild cough for 2 days",
    vitals: { hr: 96, sbp: 104, dbp: 66, rr: 20, spo2: 99, temp: 37.9, gcs: 15 },
    painScore: 2,
    minutesAgo: 12,
    status: "routed",
  });

  patients.push(...edQueue, r1Dandruff, r2Doris, r3Ines);

  // --------------------------------------------------------------- audit seed
  edQueue.forEach((p) => {
    audit.push(buildAudit(p, "ai_recommendation"));
  });
  audit.push(buildAudit(p10Eleanor, "clinician_override", {
    at: overrideAt,
    reason: p10Eleanor.clinicianDecision.reason,
    clinician: "RN K. Alvarez",
    finalEsi: 2,
    importantChange: "Clinician escalated AI L3 → L2 — high-risk mechanism (elderly fall on anticoagulants).",
  }));
  audit.push(buildAudit(p6Grace, "ai_reassessment", {
    at: new Date(now - 3 * 60000),
    finalEsi: 2,
    importantChange: "Deterioration while waiting — vitals re-checked (SpO₂ 93→91%, RR 22→27). L3 → L2.",
  }));
  audit.push(buildAudit(p7Marcus, "ai_recommendation", {
    at: new Date(now - 18 * 60000),
    finalEsi: 2,
    importantChange: "Safety floor applied — low confidence + symptom conflict escalated L3 → L2.",
  }));
  audit.push(buildAudit(p12Priya, "clinician_accept", {
    at: new Date(now - 42 * 60000),
    finalEsi: 4,
    clinician: "RN T. Osei",
  }));

  return { patients, audit, idCounter };
}

export const SURGE_ARRIVALS = [
  {
    name: "Andre Silva", age: 63, sex: "M",
    complaint: "Severe shortness of breath, COPD exacerbation",
    vitals: { hr: 116, sbp: 140, dbp: 84, rr: 28, spo2: 88, temp: 37.5, gcs: 15 },
    painScore: 5,
    history: { hasRecord: true, comorbidities: ["copd"] },
    minutesAgo: 55,
  },
  {
    name: "Maria Lopez", age: 45, sex: "F",
    complaint: "Severe chest pain radiating to jaw, with sweating",
    vitals: { hr: 108, sbp: 128, dbp: 78, rr: 24, spo2: 95, temp: 37.1, gcs: 15 },
    painScore: 8,
    history: { hasRecord: true, comorbidities: ["cardiac"] },
    minutesAgo: 48,
  },
  {
    name: "Omar Farouk", age: 55, sex: "M",
    complaint: "Chest tightness and shortness of breath, known cardiac history",
    vitals: { hr: 118, sbp: 132, dbp: 84, rr: 26, spo2: 93, temp: 37.2, gcs: 15 },
    painScore: 6,
    history: { hasRecord: true, comorbidities: ["cardiac", "htn"] },
    minutesAgo: 41,
  },
  {
    name: "Isabella Moretti", age: 72, sex: "F",
    complaint: "Severe abdominal pain and vomiting since last night",
    vitals: { hr: 116, sbp: 96, dbp: 58, rr: 20, spo2: 96, temp: 37.8, gcs: 15 },
    painScore: 9,
    minutesAgo: 33,
  },
  {
    name: "Chen Wei", age: 9, sex: "F",
    complaint: "High fever and difficulty breathing",
    vitals: { hr: 132, sbp: 98, dbp: 62, rr: 28, spo2: 96, temp: 39.4, gcs: 15 },
    painScore: 4,
    minutesAgo: 26,
  },
  {
    name: "Ruth Chen", age: 68, sex: "F",
    complaint: "Dizzy, chest tightness and weakness on standing",
    vitals: { hr: 124, sbp: 96, dbp: 60, rr: 18, spo2: 94, temp: 36.7, gcs: 15 },
    painScore: 3,
    history: { hasRecord: true, comorbidities: ["htn"] },
    minutesAgo: 19,
  },
  {
    name: "Tom Osei", age: 31, sex: "M",
    complaint: "Moderate abdominal pain after eating, pain worse than yesterday",
    vitals: { hr: 102, sbp: 120, dbp: 74, rr: 18, spo2: 98, temp: 37.2, gcs: 15 },
    painScore: 8,
    minutesAgo: 9,
  },
  {
    name: "Lena Fischer", age: 24, sex: "F",
    complaint: "Chest pain and rapid heartbeat after intense gym session",
    vitals: { hr: 118, sbp: 120, dbp: 76, rr: 22, spo2: 98, temp: 36.8, gcs: 15 },
    painScore: 5,
    minutesAgo: 4,
  },
];
