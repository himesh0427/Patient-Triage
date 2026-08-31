import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { triageApi, patientsApi } from '../services/api';
import TopNav from '../components/TopNav';
import EsiSquareBadge from '../components/EsiSquareBadge';
import VitalField from '../components/VitalField';
import { validateAllVitals } from '../services/vitals';
import {
  Search, UserPlus, UserCheck, AlertTriangle, ShieldCheck,
  Lock, X, Plus, Sparkles, ArrowRight, ArrowLeft, HeartPulse,
  CheckCircle2, Activity, Zap, Check
} from 'lucide-react';

const generatePatientId = () => `P-${Math.floor(100 + Math.random() * 900)}`;
const generateVisitId = () => `V-${Math.floor(100 + Math.random() * 900)}`;

export default function PatientIntake() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [patientId] = useState(generatePatientId());
  const [visitId] = useState(generateVisitId());
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [ageInMonths, setAgeInMonths] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [newConditionInput, setNewConditionInput] = useState('');
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [hipaaConsent, setHipaaConsent] = useState(false);

  const [triageStage, setTriageStage] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [vitals, setVitals] = useState({
    hr: '',
    sbp: '',
    dbp: '',
    rr: '',
    temp: '',
    spo2: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const commonConditions = [
    'Hypertension',
    'Type 2 Diabetes',
    'Asthma',
    'COPD',
    'Coronary Artery Disease / Prior MI',
    'Heart Failure (CHF)',
    'Chronic Kidney Disease (CKD)',
    'Stroke / TIA history',
    'Seizure disorder / Epilepsy',
    'Cancer',
    'Liver disease',
    'Blood / bleeding disorder',
    'Immunocompromised',
    'Sickle cell disease',
    'Pregnancy',
    'Recent surgery',
    'Recent hospitalization',
  ];

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setSearchPerformed(true);
    try {
      const res = await patientsApi.searchPatients(searchQuery.trim());
      setSearchResults(res.data.results || []);
    } catch (err) {
      console.error("Patient search error:", err);
      setError("Failed to search patient database.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    setFullName(p.name);
    setAge(p.age.toString());
    setGender(p.gender || 'Other');
    setMedicalHistory(p.has_history ? ['Hypertension', 'Prior ER Visit'] : []);
    setHipaaConsent(false);
  };

  const handleDobChange = (e) => {
    const val = e.target.value;
    setDob(val);
    if (val) {
      const birthDate = new Date(val);
      const diff = Date.now() - birthDate.getTime();
      const ageDate = new Date(diff);
      const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
      setAge(calculatedAge.toString());
    }
  };

  const addCondition = (condition) => {
    const trimmed = condition.trim();
    if (trimmed && !medicalHistory.includes(trimmed)) {
      setMedicalHistory([...medicalHistory, trimmed]);
      setNewConditionInput('');
      setShowAddCondition(false);
    }
  };

  const removeCondition = (conditionToRemove) => {
    setMedicalHistory(medicalHistory.filter((c) => c !== conditionToRemove));
  };

  const handleUnresponsiveBypass = async () => {
    if (!window.confirm("Fast-track patient for IMMEDIATE resuscitation (ESI 1)? This bypasses registration forms.")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await triageApi.bypass({
        name: fullName || 'Emergency Unresponsive Patient',
        age: age ? parseInt(age, 10) : 45,
        gender: gender || 'Other',
        condition: 'Immediate Life Threat / Unresponsive / Resuscitation',
      });
      navigate(`/visit/${res.data.visit_id}`);
    } catch (err) {
      console.error(err);
      setError("Failed to trigger emergency bypass.");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToTriage = (e) => {
    if (e) e.preventDefault();
    if (!hipaaConsent) {
      setError("Patient / guardian consent for triage data processing (HIPAA) is required.");
      return;
    }
    if (mode === 'new' && (!fullName.trim() || !age)) {
      setError("Please provide patient full name and age.");
      return;
    }
    setError(null);
    setTriageStage(true);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!chiefComplaint.trim()) {
      setError("Please describe the patient's chief complaint / symptoms.");
      return;
    }

    const errors = validateAllVitals(vitals);
    if (Object.keys(errors).length > 0) {
      setError('Some vital signs are outside safe input limits. Please correct them before continuing.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        patient_id: selectedPatient?.id || undefined,
        name: fullName,
        age: parseInt(age, 10) || 30,
        gender: gender,
        has_history: medicalHistory.length > 0,
        symptom_text: chiefComplaint.trim(),
        vitals: {
          hr: vitals.hr ? parseFloat(vitals.hr) : null,
          sbp: vitals.sbp ? parseFloat(vitals.sbp) : null,
          dbp: vitals.dbp ? parseFloat(vitals.dbp) : null,
          rr: vitals.rr ? parseFloat(vitals.rr) : null,
          temp: vitals.temp ? parseFloat(vitals.temp) : null,
          spo2: vitals.spo2 ? parseFloat(vitals.spo2) : null,
        },
      };

      const res = await triageApi.predictOneShot(payload);
      navigate(`/visit/${res.data.visit_id}`);
    } catch (err) {
      console.error("Triage prediction failed:", err);
      setError(err.response?.data?.detail || "Failed to submit patient triage.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setMode('select');
    setSelectedPatient(null);
    setFullName('');
    setAge('');
    setDob('');
    setPhone('');
    setMedicalHistory([]);
    setHipaaConsent(false);
    setTriageStage(false);
    setError(null);
  };

  return (
    <>
      <TopNav
        title="Patient Registration & Intake"
        subtitle="ED Patient Intake, Demographic Verification & Clinical Assessment"
      />

      <div className="page-container">
        <div
          style={{
            marginBottom: '1.25rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-lg)',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <HeartPulse size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.92rem', color: '#991b1b' }}>
                  Critical Life Threat / Unresponsive Patient?
                </strong>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: '#dc2626',
                    color: '#ffffff',
                    letterSpacing: '0.03em',
                  }}
                >
                  FAST-TRACK ESI 1
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '0.15rem' }}>
                Bypass intake forms for immediate cardiac arrest, severe trauma, or airway compromise.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleUnresponsiveBypass}
            disabled={loading}
            className="btn"
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: '1px solid #b91c1c',
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Zap size={14} /> Immediate ESI-1 Bypass
          </button>
        </div>

        {error && (
          <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {!triageStage ? (
          <div className="ui-card">
            <div style={{ marginBottom: '2rem' }}>
              <label className="form-label-clean" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Select Registration Type
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('new');
                    setSelectedPatient(null);
                    setError(null);
                  }}
                  style={{
                    padding: '1.5rem 1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    border: mode === 'new' ? '2px solid var(--primary-blue)' : '1px solid var(--card-border)',
                    background: mode === 'new' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.6rem',
                    transition: 'all 0.15s ease',
                    boxShadow: mode === 'new' ? '0 0 0 3px rgba(29, 78, 216, 0.12)' : 'none'
                  }}
                >
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: mode === 'new' ? 'var(--primary-blue)' : '#f1f5f9',
                    color: mode === 'new' ? '#ffffff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <UserPlus size={22} />
                  </div>
                  <strong style={{ fontSize: '1.05rem', color: mode === 'new' ? 'var(--primary-blue)' : 'var(--text-title)' }}>
                    ➕ New Patient
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Register a new ER arrival &amp; auto-generate IDs
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('returning');
                    setSelectedPatient(null);
                    setError(null);
                  }}
                  style={{
                    padding: '1.5rem 1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    border: mode === 'returning' ? '2px solid var(--primary-blue)' : '1px solid var(--card-border)',
                    background: mode === 'returning' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.6rem',
                    transition: 'all 0.15s ease',
                    boxShadow: mode === 'returning' ? '0 0 0 3px rgba(29, 78, 216, 0.12)' : 'none'
                  }}
                >
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: mode === 'returning' ? 'var(--primary-blue)' : '#f1f5f9',
                    color: mode === 'returning' ? '#ffffff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Search size={22} />
                  </div>
                  <strong style={{ fontSize: '1.05rem', color: mode === 'returning' ? 'var(--primary-blue)' : 'var(--text-title)' }}>
                    🔍 Returning Patient
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Lookup historical MRN &amp; prior visit records
                  </span>
                </button>
              </div>
            </div>

            {mode === 'returning' && (
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '1rem' }}>
                  Returning Patient Lookup
                </h3>

                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <input
                      type="text"
                      className="input-clean"
                      placeholder="Enter Patient ID, Name, or Phone Number"
                      style={{ paddingLeft: '2.4rem' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-blue" disabled={loading}>
                    <Search size={16} /> {loading ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {searchPerformed && !selectedPatient && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    {searchResults.length === 0 ? (
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid var(--card-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.5rem',
                        textAlign: 'center'
                      }}>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                          No patient found. Create new patient?
                        </p>
                        <button
                          type="button"
                          className="btn-blue"
                          onClick={() => setMode('new')}
                        >
                          <Plus size={16} /> Create New Patient
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Matching Patient Records ({searchResults.length}):
                        </div>
                        {searchResults.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectPatient(p)}
                            style={{
                              padding: '1rem',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--card-border)',
                              background: '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-blue)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--card-border)'}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <strong style={{ fontSize: '0.95rem', color: 'var(--text-title)' }}>{p.name}</strong>
                                <span className="status-pill in-room">P-{p.id}</span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                Age {p.age} · {p.gender} · Last Visit: {p.has_history ? 'Recent ER Record on file' : 'First Visit'}
                              </div>
                            </div>
                            <button type="button" className="btn-white" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                              Select Patient →
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedPatient && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #bfdbfe',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-blue)' }}>
                          Selected Patient Record
                        </span>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-title)', marginTop: '0.2rem' }}>
                          {selectedPatient.name}
                        </h4>
                      </div>
                      <button
                        type="button"
                        className="btn-white"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => setSelectedPatient(null)}
                      >
                        Change
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Patient ID</div>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>P-{selectedPatient.id}</div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Age / Gender</div>
                        <div style={{ fontWeight: 700 }}>{selectedPatient.age} yrs · {selectedPatient.gender}</div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Current Visit ID</div>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--primary-blue)' }}>{visitId}</div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Registration Time</div>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                        Medical History
                      </div>
                      {medicalHistory.length > 0 ? (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {medicalHistory.map((c, i) => (
                            <span key={i} className="status-pill in-room">{c}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="status-pill discharged">Zero-History Patient</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem', background: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                      <input
                        type="checkbox"
                        id="hipaa-consent-returning"
                        checked={hipaaConsent}
                        onChange={(e) => setHipaaConsent(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary-blue)', cursor: 'pointer' }}
                        required
                      />
                      <label htmlFor="hipaa-consent-returning" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-title)', cursor: 'pointer' }}>
                        Patient consents to use of data for triage (HIPAA compliance) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                      <button
                        type="button"
                        className="btn-blue"
                        onClick={handleProceedToTriage}
                      >
                        Proceed to Triage →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'new' && (
              <form onSubmit={handleProceedToTriage} style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '1.25rem' }}>
                  New Patient Registration
                </h3>

                <div className="form-grid-2" style={{ marginBottom: '1.25rem' }}>
                  <div className="form-group-clean">
                    <label className="form-label-clean">Patient ID (Auto-Generated)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="input-clean"
                        value={patientId}
                        readOnly
                        disabled
                        style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', paddingLeft: '2.2rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                      />
                      <Lock size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>
                  </div>

                  <div className="form-group-clean">
                    <label className="form-label-clean">Visit ID (Auto-Generated)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="input-clean"
                        value={visitId}
                        readOnly
                        disabled
                        style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', paddingLeft: '2.2rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                      />
                      <Lock size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>
                  </div>
                </div>

                <div className="form-group-clean">
                  <label className="form-label-clean">Full Name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="input-clean"
                    placeholder="John Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group-clean">
                    <label className="form-label-clean">Age (Years) <span className="required">*</span></label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      className="input-clean"
                      placeholder="45"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                    />
                  </div>

                  {parseFloat(age) < 1 && age !== '' && (
                    <div className="form-group-clean animate-fadeIn">
                      <label className="form-label-clean">Age in Months (Pediatric Infant)</label>
                      <input
                        type="number"
                        min="0"
                        max="11"
                        className="input-clean"
                        placeholder="e.g. 6"
                        value={ageInMonths}
                        onChange={(e) => setAgeInMonths(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="form-group-clean">
                    <label className="form-label-clean">Gender <span className="required">*</span></label>
                    <select
                      className="input-clean"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group-clean" style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="form-label-clean" style={{ margin: 0 }}>
                      Known Medical History (if any)
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                      Leave empty if unknown
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', minHeight: '32px' }}>
                    {medicalHistory.map((condition) => (
                      <span
                        key={condition}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}
                      >
                        {condition}
                        <X
                          size={13}
                          style={{ cursor: 'pointer' }}
                          onClick={() => removeCondition(condition)}
                        />
                      </span>
                    ))}
                    {medicalHistory.length === 0 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic', alignSelf: 'center' }}>
                        No conditions added yet
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {commonConditions.map((cond) => {
                      const isAdded = medicalHistory.includes(cond);
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => {
                            if (isAdded) removeCondition(cond);
                            else addCondition(cond);
                          }}
                          className={isAdded ? "btn-blue" : "btn-white"}
                          style={{
                            padding: '0.28rem 0.65rem',
                            fontSize: '0.76rem',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          {isAdded ? <Check size={12} strokeWidth={3} /> : '+'} {cond}
                        </button>
                      );
                    })}

                    {showAddCondition ? (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          type="text"
                          className="input-clean"
                          placeholder="Type condition..."
                          style={{ width: '180px', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          value={newConditionInput}
                          onChange={(e) => setNewConditionInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCondition(newConditionInput); } }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn-blue"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => addCondition(newConditionInput)}
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddCondition(true)}
                        className="btn-white"
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-blue)' }}
                      >
                        + Add Custom Condition
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)', marginBottom: '1.75rem' }}>
                  <input
                    type="checkbox"
                    id="hipaa-consent-new"
                    checked={hipaaConsent}
                    onChange={(e) => setHipaaConsent(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary-blue)', cursor: 'pointer' }}
                    required
                  />
                  <label htmlFor="hipaa-consent-new" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-title)', cursor: 'pointer' }}>
                    Patient consents to use of data for triage (HIPAA) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--card-border)', paddingTop: '1.25rem' }}>
                  <button
                    type="button"
                    className="btn-white"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-blue"
                  >
                    Save &amp; Proceed to Triage →
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleFinalSubmit} className="ui-card animate-fadeIn">
            {error && (
              <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-blue)' }}>
                  Step 2 of 2: Clinical Assessment
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title)', marginTop: '0.2rem' }}>
                  {fullName} ({age} yrs · {gender})
                </h3>
              </div>
              <span className="status-pill in-room">{visitId}</span>
            </div>

            <div className="form-group-clean">
              <label className="form-label-clean">Chief Complaint &amp; Clinical Presentation <span className="required">*</span></label>
              <textarea
                className="input-clean"
                rows={3}
                placeholder="e.g. 48yo male presenting with sudden onset chest pressure radiating to left shoulder, mild diaphoresis..."
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '0.85rem' }}>
                Measured Vital Signs
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '0.5rem' }}>
                <VitalField code="hr" value={vitals.hr} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="sbp" value={vitals.sbp} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="dbp" value={vitals.dbp} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="spo2" value={vitals.spo2} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="rr" value={vitals.rr} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="temp" value={vitals.temp} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--card-border)', paddingTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-white"
                onClick={() => setTriageStage(false)}
              >
                <ArrowLeft size={16} /> Back to Registration
              </button>

              <button
                type="submit"
                className="btn-blue"
                disabled={loading}
              >
                <Sparkles size={16} />
                {loading ? 'Evaluating AI Triage...' : 'Submit & Compute LightGBM ESI'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
