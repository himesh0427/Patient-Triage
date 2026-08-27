import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { HOSPITALS } from "./data/hospitals";
import { createSeedState, SURGE_ARRIVALS } from "./data/seed";
import { extractClinicalFeatures } from "./lib/nlp";
import { decidePathway } from "./lib/routing";
import { computeTriage, ageGroupOf, SLA_MINUTES, ESI_META } from "./lib/esi";
import { minutesBetween } from "./lib/format";
import { api, pingBackend } from "./lib/api";

const StoreContext = createContext(null);

let counter = 100;
const nextId = () => `P${String(++counter).padStart(3, "0")}`;
const nextMrn = () => `MRN-${Math.floor(100000 + Math.random() * 800000)}`;
const nextAuditId = () => `AUD-${Math.floor(1000 + Math.random() * 9000)}`;

function auditEntry(p, action, opts = {}) {
  return {
    id: nextAuditId(),
    at: opts.at ?? new Date(),
    patientId: p.id,
    patientName: p.name,
    action,
    aiEsi: opts.aiEsi ?? p.triage?.esi ?? null,
    aiConfidence: p.triage?.confidence ?? null,
    finalEsi: opts.finalEsi ?? p.clinicianDecision?.level ?? p.triage?.esi ?? null,
    overrideReason: opts.reason ?? p.clinicianDecision?.reason ?? null,
    clinician: opts.clinician ?? p.clinicianDecision?.clinician ?? "RN (on shift)",
    importantChange: opts.importantChange ?? null,
    modelVersion: p.triage?.modelVersion ?? "PT-Triage v0.9.2-hackathon",
  };
}

export function currentLevel(p) {
  if (p.clinicianDecision?.level) return p.clinicianDecision.level;
  return p.triage?.esi ?? 5;
}

const VITAL_LABELS = {
  hr: "Heart rate",
  sbp: "Blood pressure",
  rr: "Respiratory rate",
  spo2: "SpO₂",
  temp: "Temperature",
  gcs: "GCS",
};

// ------------------------------------------------------------- API -> UI maps
function mapTriage(t, vitals) {
  const missingLabels = ["hr", "sbp", "rr", "spo2", "temp", "gcs"].filter((k) => vitals[k] == null).map((k) => VITAL_LABELS[k]);
  return {
    esi: t.severity,
    urgency: ESI_META[t.severity].label,
    confidence: t.confidence,
    confidenceScore: t.confidence_score,
    completeness: t.completeness,
    factors: t.factors,
    gate: t.gate ? { text: t.gate } : null,
    escalated: t.escalated,
    points: t.points,
    missing: missingLabels.length,
    missingLabels,
    modelVersion: t.model_version,
    computedAt: new Date(t.computed_at),
  };
}

function mapPatient(bp, hospitalId) {
  const features = extractClinicalFeatures(bp.complaint, bp.vitals);
  const observedSymptoms = bp.observed_symptoms ?? [];
  const routing = decidePathway({
    complaint: bp.complaint, features, vitals: bp.vitals,
    painScore: bp.pain_score, ageGroup: ageGroupOf(bp.age),
    hospital: HOSPITALS[hospitalId], observedSymptoms,
  });

  let initialTriage = null;
  if (bp.deteriorated) {
    const ev = (bp.events ?? []).find((e) => e.type === "reassess-alert");
    const m = ev && (ev.detail.match(/L(\d)\s*→\s*L(\d)/) || ev.detail.match(/L(\d)\s*->\s*L(\d)/));
    initialTriage = m ? { esi: Number(m[1]) } : { esi: Math.min(5, bp.triage.severity + 1) };
  }

  return {
    id: bp.id,
    mrn: bp.mrn,
    name: bp.name,
    age: bp.age,
    sex: bp.sex,
    ageGroup: bp.age_group,
    complaint: bp.complaint,
    complaintTag: bp.complaint_tag,
    features,
    vitals: { ...bp.vitals },
    painScore: bp.pain_score,
    observedSymptoms,
    history: { hasRecord: bp.history.has_record, comorbidities: bp.history.comorbidities },
    arrivedAt: new Date(bp.arrived_at),
    routing,
    triage: mapTriage(bp.triage, bp.vitals),
    initialTriage,
    clinicianDecision: bp.clinician_decision
      ? {
          kind: bp.clinician_decision.kind,
          level: bp.clinician_decision.level,
          reason: bp.clinician_decision.reason,
          notes: null,
          clinician: bp.clinician_decision.clinician,
          at: new Date(bp.clinician_decision.decided_at),
        }
      : null,
    status: bp.status,
    deteriorated: bp.deteriorated,
    lastReassessedAt: bp.last_reassessed_at ? new Date(bp.last_reassessed_at) : new Date(bp.arrived_at),
    events: (bp.events ?? []).map((e) => ({ ...e, at: new Date(e.at) })),
  };
}

function mapAudit(a) {
  return {
    id: a.id,
    at: new Date(a.at),
    patientId: a.patient_id,
    patientName: a.patient_name,
    action: a.action,
    aiEsi: a.ai_severity,
    aiConfidence: a.ai_confidence,
    finalEsi: a.override_level ?? a.ai_severity,
    overrideReason: a.override_reason,
    clinician: a.clinician,
    importantChange:
      a.action === "clinician_override"
        ? `Clinician decision differs from AI recommendation (AI L${a.ai_severity} → L${a.override_level}).`
        : a.action === "ai_reassessment"
          ? "Automatic reassessment after vitals re-check — clinician review required."
          : null,
    modelVersion: a.model_version,
  };
}

function localPatient({ name, age, sex, complaint, features, observed, vitals, painScore, history, routing, triage, decision, status }) {
  return {
    id: nextId(),
    mrn: nextMrn(),
    name, age, sex,
    ageGroup: ageGroupOf(age),
    complaint,
    features,
    vitals: { ...vitals },
    painScore,
    observedSymptoms: observed,
    history: { hasRecord: history?.hasRecord ?? false, comorbidities: [...(history?.comorbidities ?? [])] },
    arrivedAt: new Date(),
    routing,
    triage,
    initialTriage: null,
    clinicianDecision: decision ? { ...decision, at: new Date() } : null,
    status,
    deteriorated: false,
    events: [{ at: new Date(), type: "arrival", detail: "Patient arrived and intake data recorded." }],
  };
}

export function StoreProvider({ children }) {
  const [seedState] = useState(() => createSeedState("urban"));
  const seedStateRef = useRef(seedState);
  const [hospitalId, setHospitalId] = useState("urban");
  const [edPatients, setEdPatients] = useState(() => seedState.patients.filter((p) => p.status === "queued"));
  const [routedPatients, setRoutedPatients] = useState(() => seedState.patients.filter((p) => p.status === "routed"));
  const [audit, setAudit] = useState(() => seedState.audit);
  const [surgeOn, setSurgeOn] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [apiStatus, setApiStatus] = useState("checking");

  const hospitalIdRef = useRef(hospitalId);
  const apiStatusRef = useRef(apiStatus);
  const surgeOnRef = useRef(surgeOn);
  const surgePatientIds = useRef([]);
  const syncedRef = useRef(false);
  const edPatientsRef = useRef(edPatients);

  useEffect(() => { hospitalIdRef.current = hospitalId; }, [hospitalId]);
  useEffect(() => { apiStatusRef.current = apiStatus; }, [apiStatus]);
  useEffect(() => { surgeOnRef.current = surgeOn; }, [surgeOn]);
  useEffect(() => { edPatientsRef.current = edPatients; }, [edPatients]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const effectiveNow = useMemo(() => new Date(now.getTime() + clockOffset), [now, clockOffset]);

  // ---------------------------------------------------------- seed / connect
  const upsertEd = (mapped) =>
    setEdPatients((list) =>
      list.some((p) => p.id === mapped.id)
        ? list.map((p) => (p.id === mapped.id ? mapped : p))
        : [mapped, ...list]
    );

  const refreshAudit = async () => {
    try {
      setAudit((await api.audit()).map(mapAudit));
    } catch {
      /* keep current */
    }
  };

  const syncFromBackend = async () => {
    if (await pingBackend(3000)) {
      try {
        await api.reset();
        const [queueData, auditData] = await Promise.all([api.queue(), api.audit()]);
        setEdPatients(queueData.map((bp) => mapPatient(bp, hospitalIdRef.current)));
        setRoutedPatients(seedStateRef.current.patients.filter((p) => p.status === "routed"));
        setAudit(auditData.map(mapAudit));
        setApiStatus("online");
      } catch (e) {
        console.error("[PatientTriage] backend sync failed — using local engine:", e);
        setApiStatus("offline");
      }
    } else {
      setApiStatus("offline");
    }
  };

  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    syncFromBackend();
  }, []);

  const retryConnect = async () => {
    setApiStatus("checking");
    await syncFromBackend();
  };

  const setHospital = (id) => {
    if (!HOSPITALS[id]) return;
    setHospitalId(id);
    const reroute = (p) => {
      const routing = decidePathway({
        complaint: p.complaint, features: p.features, vitals: p.vitals,
        painScore: p.painScore, ageGroup: ageGroupOf(p.age),
        hospital: HOSPITALS[id], observedSymptoms: p.observedSymptoms,
      });
      return { ...p, routing };
    };
    setEdPatients((list) => list.map(reroute));
    setRoutedPatients((list) => list.map(reroute));
  };

  // ------------------------------------------------------------- intake flow
  const analyzePatient = async ({ complaint, age, sex, vitals, painScore, extraObserved = [], history }) => {
    const features = extractClinicalFeatures(complaint, vitals);
    const observed = [...new Set([...features.observedSymptoms, ...extraObserved])];
    const routing = decidePathway({
      complaint, features, vitals, painScore,
      ageGroup: ageGroupOf(age), hospital: HOSPITALS[hospitalIdRef.current],
      observedSymptoms: observed,
    });

    if (apiStatusRef.current === "online" && routing.needsTriage) {
      const intake = {
        name: "New Patient",
        age, sex, complaint,
        complaint_tag: features.tag,
        vitals: { ...vitals, gcs: vitals.gcs ?? 15 },
        pain_score: painScore,
        observed_symptoms: observed,
        history: { has_record: history?.hasRecord ?? false, comorbidities: history?.comorbidities ?? [] },
        arrived_at: new Date().toISOString(),
      };
      try {
        const bp = await api.createPatient(intake);
        const mapped = mapPatient(bp, hospitalIdRef.current);
        upsertEd(mapped);
        setAudit((a) => [auditEntry(mapped, "ai_recommendation"), ...a]);
        return { features, observed, routing, triage: mapped.triage, backendId: mapped.id };
      } catch (e) {
        console.error("[PatientTriage] intake via API failed — falling back to local engine:", e);
        setApiStatus("offline");
      }
    }

    const triage = routing.needsTriage
      ? computeTriage({
          age, vitals, painScore, observedSymptoms: observed,
          hasHistoryRecord: history?.hasRecord ?? false,
          comorbidities: history?.comorbidities ?? [],
          complaintTag: features.tag, mode: surgeOnRef.current ? "surge" : "normal",
        })
      : null;
    return { features, observed, routing, triage, backendId: null };
  };

  const commitIntake = async ({ name, age, sex, complaint, vitals, painScore, extraObserved, history, features, observed, routing, triage, backendId, decision }) => {
    // Online: the patient was already created during analyze — record the clinician decision.
    if (apiStatusRef.current === "online" && backendId) {
      try {
        const updated = decision?.kind === "override"
          ? await api.override(backendId, { level: decision.level, reason: decision.reason, clinician: decision.clinician })
          : await api.accept(backendId, decision?.clinician ?? "RN (on shift)");
        upsertEd(mapPatient(updated, hospitalIdRef.current));
        await refreshAudit();
        return;
      } catch (e) {
        console.error(e);
        setApiStatus("offline");
      }
    }
    if (apiStatusRef.current === "online" && routing && !routing.needsTriage) {
      setRoutedPatients((list) => [
        localPatient({ name, age, sex, complaint, features, observed, vitals, painScore, history, routing, triage, decision: null, status: "routed" }),
        ...list,
      ]);
      return;
    }

    // Offline path — local engine.
    const p = localPatient({
      name, age, sex, complaint, features, observed, vitals, painScore, history, routing, triage,
      decision: decision ? { ...decision, at: new Date() } : null,
      status: decision || routing?.needsTriage ? "queued" : "routed",
    });
    if (p.status === "routed") {
      setRoutedPatients((list) => [p, ...list]);
    } else {
      setEdPatients((list) => [p, ...list]);
      const action = decision
        ? decision.kind === "override" ? "clinician_override" : "clinician_accept"
        : "ai_recommendation";
      setAudit((a) => [
        auditEntry(p, action, {
          finalEsi: decision?.level ?? p.triage?.esi ?? null,
          reason: decision?.reason,
          clinician: decision?.clinician ?? "RN (on shift)",
          importantChange: decision?.kind === "override"
            ? `Clinician decision differs from AI recommendation (AI L${p.triage?.esi ?? "—"} → L${decision.level}).`
            : null,
        }),
        ...a,
      ]);
    }
  };

  // ------------------------------------------------------------- decisions
  const accept = async (patientId, clinician = "RN (on shift)") => {
    if (apiStatusRef.current === "online") {
      try {
        const updated = await api.accept(patientId, clinician);
        upsertEd(mapPatient(updated, hospitalIdRef.current));
        await refreshAudit();
        return;
      } catch (e) {
        console.error(e);
        setApiStatus("offline");
      }
    }
    const p = edPatientsRef.current.find((x) => x.id === patientId);
    if (!p) return;
    const updated = { ...p, clinicianDecision: { kind: "accept", level: p.triage.esi, reason: null, clinician, at: new Date() } };
    setEdPatients((list) => list.map((x) => (x.id === patientId ? updated : x)));
    setAudit((a) => [auditEntry(updated, "clinician_accept", { finalEsi: p.triage.esi, clinician }), ...a]);
  };

  const overridePatient = async (patientId, { level, reason, notes, clinician }) => {
    if (apiStatusRef.current === "online") {
      try {
        const updated = await api.override(patientId, { level, reason, clinician });
        upsertEd(mapPatient(updated, hospitalIdRef.current));
        await refreshAudit();
        return;
      } catch (e) {
        console.error(e);
        setApiStatus("offline");
      }
    }
    const p = edPatientsRef.current.find((x) => x.id === patientId);
    if (!p) return;
    const updated = {
      ...p,
      clinicianDecision: { kind: "override", level, reason, notes, clinician, at: new Date() },
    };
    setEdPatients((list) => list.map((x) => (x.id === patientId ? updated : x)));
    setAudit((a) => [
      auditEntry(updated, "clinician_override", {
        finalEsi: level, reason, clinician,
        importantChange: `Clinician decision differs from AI recommendation (AI L${p.triage?.esi ?? "—"} → L${level}).`,
      }),
      ...a,
    ]);
  };

  const reassess = async (patientId, newVitals, painScore) => {
    if (apiStatusRef.current === "online") {
      try {
        const updated = await api.reassess(patientId, { vitals: newVitals, pain_score: painScore });
        upsertEd(mapPatient(updated, hospitalIdRef.current));
        await refreshAudit();
        return;
      } catch (e) {
        console.error(e);
        setApiStatus("offline");
      }
    }
    const p = edPatientsRef.current.find((x) => x.id === patientId);
    if (!p) return;
    const prevLevel = currentLevel(p);
    const triage = computeTriage({
      age: p.age, vitals: newVitals, painScore,
      observedSymptoms: p.observedSymptoms,
      hasHistoryRecord: p.history?.hasRecord ?? false,
      comorbidities: p.history?.comorbidities ?? [],
      complaintTag: p.features.tag, mode: surgeOnRef.current ? "surge" : "normal",
    });
    const worsened = triage.esi < prevLevel;
    const updated = {
      ...p,
      vitals: { ...newVitals },
      painScore,
      triage,
      lastReassessedAt: new Date(),
      deteriorated: worsened || p.deteriorated,
      initialTriage: p.initialTriage ?? p.triage,
      clinicianDecision: worsened ? null : p.clinicianDecision,
      events: [
        { at: new Date(), type: "vitals", detail: `Vitals re-recorded: HR ${newVitals.hr}, RR ${newVitals.rr}, SpO₂ ${newVitals.spo2}%, Temp ${newVitals.temp}°C.` },
        ...(worsened
          ? [{ at: new Date(), type: "reassess-alert", detail: `Automatic reassessment: severity escalated L${prevLevel} → L${triage.esi}. Clinician review required.` }]
          : []),
        ...p.events,
      ],
    };
    setEdPatients((list) => list.map((x) => (x.id === patientId ? updated : x)));
    setAudit((a) => [
      auditEntry(updated, worsened ? "ai_reassessment" : "ai_recheck", {
        finalEsi: triage.esi,
        importantChange: worsened
          ? `Deterioration while waiting — vitals re-checked. L${prevLevel} → L${triage.esi}.`
          : `Routine re-check — tier unchanged (L${triage.esi}).`,
      }),
      ...a,
    ]);
  };

  // ------------------------------------------------------------- surge
  const createSurgeArrival = async (spec) => {
    const features = extractClinicalFeatures(spec.complaint, spec.vitals);
    const observed = [...new Set([...features.observedSymptoms])];

    if (apiStatusRef.current === "online") {
      const intake = {
        name: spec.name, age: spec.age, sex: spec.sex, complaint: spec.complaint,
        complaint_tag: features.tag,
        vitals: { ...spec.vitals, gcs: spec.vitals.gcs ?? 15 },
        pain_score: spec.painScore,
        observed_symptoms: observed,
        history: { has_record: spec.history?.hasRecord ?? false, comorbidities: spec.history?.comorbidities ?? [] },
        arrived_at: new Date(Date.now() - spec.minutesAgo * 60000).toISOString(),
      };
      const bp = await api.createPatient(intake);
      const mapped = mapPatient(bp, hospitalIdRef.current);
      setEdPatients((list) => [mapped, ...list]);
      setAudit((a) => [auditEntry(mapped, "ai_recommendation"), ...a]);
      return mapped;
    }

    const routing = decidePathway({
      complaint: spec.complaint, features, vitals: spec.vitals, painScore: spec.painScore,
      ageGroup: ageGroupOf(spec.age), hospital: HOSPITALS[hospitalIdRef.current], observedSymptoms: observed,
    });
    const triage = routing.needsTriage
      ? computeTriage({
          age: spec.age, vitals: spec.vitals, painScore: spec.painScore,
          observedSymptoms: observed,
          hasHistoryRecord: spec.history?.hasRecord ?? false,
          comorbidities: spec.history?.comorbidities ?? [],
          complaintTag: features.tag, mode: "surge",
        })
      : null;
    const p = localPatient({
      name: spec.name, age: spec.age, sex: spec.sex, complaint: spec.complaint,
      features, observed, vitals: spec.vitals, painScore: spec.painScore,
      history: spec.history, routing, triage, decision: null, status: "queued",
    });
    p.arrivedAt = new Date(Date.now() - spec.minutesAgo * 60000);
    setEdPatients((list) => [...list, p]);
    setAudit((a) => [auditEntry(p, "ai_recommendation"), ...a]);
    return p;
  };

  const toggleSurge = async () => {
    if (!surgeOn) {
      if (apiStatusRef.current === "online") {
        try {
          await api.setMode("surge");
        } catch (e) {
          console.error(e);
          setApiStatus("offline");
        }
      }
      const created = [];
      for (const spec of SURGE_ARRIVALS) {
        try {
          created.push(await createSurgeArrival(spec));
        } catch (e) {
          console.error("[PatientTriage] surge arrival failed:", e);
        }
      }
      surgePatientIds.current = created.map((p) => p.id);
      setSurgeOn(true);
      setClockOffset(45 * 60000);
    } else {
      if (apiStatusRef.current === "online") {
        try {
          await api.setMode("normal");
          await Promise.all(surgePatientIds.current.map((id) => api.discharge(id)));
        } catch (e) {
          console.error(e);
        }
      }
      const ids = new Set(surgePatientIds.current);
      setEdPatients((list) => list.filter((p) => !ids.has(p.id)));
      surgePatientIds.current = [];
      setSurgeOn(false);
      setClockOffset(0);
    }
  };

  // ------------------------------------------------------------- derived
  const queue = useMemo(() => {
    return edPatients
      .filter((p) => p.status === "queued" && p.routing?.needsTriage !== false && p.triage)
      .sort((a, b) => {
        const la = currentLevel(a);
        const lb = currentLevel(b);
        if (la !== lb) return la - lb;
        return minutesBetween(b.arrivedAt, effectiveNow) - minutesBetween(a.arrivedAt, effectiveNow);
      });
  }, [edPatients, effectiveNow]);

  const alerts = useMemo(() => {
    const out = [];
    queue.forEach((p) => {
      const lvl = currentLevel(p);
      const wait = minutesBetween(p.arrivedAt, effectiveNow);
      const sla = SLA_MINUTES[lvl] ?? 120;
      if (wait >= sla && lvl >= 2) {
        out.push({
          patient: p,
          kind: "sla",
          severity: "high",
          title: "Waiting beyond safe threshold",
          detail: `P${p.id.slice(-3)} · ESI ${lvl} · waited ${wait} min (limit ${sla} min). Reassess now.`,
        });
      }
      if (p.deteriorated && p.initialTriage) {
        out.push({
          patient: p,
          kind: "deterioration",
          severity: "critical",
          title: "Deterioration detected",
          detail: `ESI ${p.initialTriage.esi} → ${p.triage.esi}. Immediate nurse reassessment recommended.`,
        });
      }
      if (p.triage && p.triage.confidence === "Low") {
        out.push({
          patient: p,
          kind: "uncertain",
          severity: "medium",
          title: "Previous assessment uncertain",
          detail: `Low decision confidence (${p.triage.confidenceScore}%). Missing data: ${p.triage.missingLabels.join(", ") || "none"} — recommend re-check.`,
        });
      }
    });
    return out;
  }, [queue, effectiveNow]);

  const kpis = useMemo(() => {
    const waiting = queue.length;
    const critical = queue.filter((p) => currentLevel(p) <= 2).length;
    const reassessCount = alerts.length;
    const avgWait =
      queue.length > 0
        ? Math.round(queue.reduce((s, p) => s + minutesBetween(p.arrivedAt, effectiveNow), 0) / queue.length)
        : 0;
    return { waiting, critical, reassessCount, avgWait };
  }, [queue, alerts, effectiveNow]);

  const value = {
    now,
    effectiveNow,
    hospitalId,
    hospitals: HOSPITALS,
    hospital: HOSPITALS[hospitalId],
    setHospital,
    surgeOn,
    toggleSurge,
    clockOffset,
    patients: [...edPatients, ...routedPatients],
    queue,
    audit,
    alerts,
    kpis,
    apiStatus,
    retryConnect,
    analyzePatient,
    commitIntake,
    accept,
    overridePatient,
    reassess,
    currentLevel,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
