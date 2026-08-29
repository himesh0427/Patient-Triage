import React, { useState } from 'react';
import { overrideApi } from '../services/api';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

export default function OverrideModal({ visitId, currentEsi, patientName, onClose, onSuccess }) {
  const [newEsi, setNewEsi] = useState(currentEsi || 3);
  const [reason, setReason] = useState('');
  const [nurseId, setNurseId] = useState('RN-042');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a clinical justification for the override.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await overrideApi.overrideEsi(visitId, {
        new_esi: parseInt(newEsi, 10),
        reason: reason.trim(),
        nurse_id: nurseId.trim() || 'RN-Shift',
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to update ESI level. Please try again.');
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
              background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Clinician Override</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {patientName ? `Patient: ${patientName}` : `Visit #${visitId}`} (Current ESI {currentEsi})
              </p>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose} style={{ border: 'none', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">New ESI Acuity Level</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setNewEsi(lvl)}
                    className={`btn ${newEsi === lvl ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      padding: '0.75rem 0.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                      borderColor: newEsi === lvl ? 'var(--border-focus)' : 'var(--border-subtle)'
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>L{lvl}</span>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                      {lvl === 1 ? 'Resusc' : lvl === 2 ? 'Emerg' : lvl === 3 ? 'Urgent' : lvl === 4 ? 'Semi' : 'Non-Urg'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Clinical Justification (Required for Audit Log)</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Patient appears more distressed than vitals reflect; high risk for sepsis based on clinical exam."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nurse / Clinician ID</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. RN-402, Dr. Alvarez"
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
              />
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              ⚖️ <strong>Compliance Notice:</strong> This override is permanently recorded in the institutional audit log with timestamp, original AI score, and clinical justification.
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving Override...' : 'Confirm Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
