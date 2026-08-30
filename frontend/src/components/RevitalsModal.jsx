import React, { useState } from 'react';
import { triageApi } from '../services/api';
import { Activity, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import VitalField from './VitalField';
import { validateAllVitals } from '../services/vitals';

export default function RevitalsModal({ visitId, patientName, baselineVitals, onClose, onSuccess }) {
  const [vitals, setVitals] = useState({
    hr: baselineVitals?.hr ?? '',
    sbp: baselineVitals?.sbp ?? '',
    dbp: baselineVitals?.dbp ?? '',
    rr: baselineVitals?.rr ?? '',
    temp: baselineVitals?.temp ?? '',
    spo2: baselineVitals?.spo2 ?? '',
  });
  const [nurseId, setNurseId] = useState('RN-042');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateAllVitals(vitals);
    if (Object.keys(errors).length > 0) {
      setError('Some vital signs are outside safe input limits. Please correct them before continuing.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        hr: vitals.hr !== '' ? parseFloat(vitals.hr) : null,
        sbp: vitals.sbp !== '' ? parseFloat(vitals.sbp) : null,
        dbp: vitals.dbp !== '' ? parseFloat(vitals.dbp) : null,
        rr: vitals.rr !== '' ? parseFloat(vitals.rr) : null,
        temp: vitals.temp !== '' ? parseFloat(vitals.temp) : null,
        spo2: vitals.spo2 !== '' ? parseFloat(vitals.spo2) : null,
        nurse_id: nurseId.trim() || 'RN-Shift',
      };

      const res = await triageApi.recordRevitals(visitId, payload);
      setResult(res.data);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to record re-vitals. Please verify inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Activity size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Record Re-Vitals (Drift Check)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {patientName ? `Patient: ${patientName}` : `Visit #${visitId}`}
              </p>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose} style={{ border: 'none', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {result ? (
          <div className="modal-body">
            {result.drift_detected ? (
              <div className="alert-banner alert-danger">
                <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '0.25rem' }}>
                    CRITICAL VITAL DRIFT DETECTED!
                  </strong>
                  <p style={{ fontSize: '0.85rem' }}>{result.message}</p>
                </div>
              </div>
            ) : (
              <div className="alert-banner alert-success">
                <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '0.25rem' }}>
                    Vitals Stable
                  </strong>
                  <p style={{ fontSize: '0.85rem' }}>{result.message}</p>
                </div>
              </div>
            )}

            {result.alerts && result.alerts.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 className="form-label">Deterioration Triggers:</h4>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#fca5a5' }}>
                  {result.alerts.map((alert, i) => (
                    <li key={i} style={{ marginBottom: '0.35rem' }}>{alert}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={onClose}>
                Done & Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem' }}>
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Enter the latest vital sign measurements to monitor for clinical deterioration (e.g. SpO₂ drop &gt;5%, HR rise &gt;20bpm, or SBP drop &gt;15mmHg).
              </p>

              <div className="grid-2">
                <VitalField code="hr" value={vitals.hr} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="sbp" value={vitals.sbp} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="dbp" value={vitals.dbp} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="rr" value={vitals.rr} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="spo2" value={vitals.spo2} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
                <VitalField code="temp" value={vitals.temp} onChange={(c, v) => setVitals((prev) => ({ ...prev, [c]: v }))} />
              </div>

              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label className="form-label">Clinician / Nurse ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={nurseId}
                  onChange={(e) => setNurseId(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Evaluating Drift...' : 'Submit & Check Deterioration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
