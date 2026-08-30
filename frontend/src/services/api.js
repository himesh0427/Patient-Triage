import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

export const systemApi = {
  getRoot: () => api.get("/"),
  getConfig: () => api.get("/config"),
  toggleSurge: () => api.post("/config/surge"),
  setHospitalType: (hospitalType) => api.post(`/config/hospital-type?hospital_type=${hospitalType}`),
  setConfidenceThreshold: (threshold) => api.post(`/config/confidence-threshold?threshold=${threshold}`),
  getStats: () => api.get("/stats"),
  getReportsAnalytics: () => api.get("/reports/analytics"),
};

export const triageApi = {
  bypass: (payload) => api.post("/triage/bypass", payload),
  checkVitals: (payload) => api.post("/triage/vitals-check", payload),
  submitSymptoms: (visitId, payload) => api.post(`/triage/symptoms/${visitId}`, payload),
  predictOneShot: (payload) => api.post("/triage/predict", payload),
  getQueue: () => api.get("/triage/queue"),
  getVisit: (visitId) => api.get(`/triage/visit/${visitId}`),
  recordRevitals: (visitId, payload) => api.post(`/triage/revitals/${visitId}`, payload),
  discharge: (visitId) => api.post(`/triage/discharge/${visitId}`),
  accept: (visitId, payload) => api.post(`/triage/accept/${visitId}`, payload),
  simulateSurge: (scale = 3) => api.post(`/triage/surge/simulate?scale=${scale}`),
};

export const alertsApi = {
  getAll: () => api.get("/alerts"),
};

export const overrideApi = {
  overrideEsi: (visitId, payload) => api.put(`/override/visit/${visitId}`, payload),
};

export const patientsApi = {
  getPatient: (patientId) => api.get(`/patients/${patientId}`),
  searchPatients: (q) => api.get(`/patients/search/?q=${encodeURIComponent(q)}`),
  listPatients: (skip = 0, limit = 50) => api.get(`/patients/?skip=${skip}&limit=${limit}`),
};

export const auditApi = {
  getAuditLog: (visitId) => api.get(`/audit/${visitId}`),
  getAllAuditLogs: () => api.get("/audit"),
};

export const hospitalConfigApi = {
  getConfig: () => api.get("/hospital-config/"),
  saveConfig: (payload) => api.put("/hospital-config/", payload),
  applyProfile: (profile) => api.post(`/hospital-config/apply-profile?profile=${encodeURIComponent(profile)}`),
};

export default api;

