import React, { useState } from 'react';
import { triageApi } from '../services/api';
import { ShieldCheck, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export default function AcceptModal({ visitId, patientName, esiLevel, confidence, onClose, onSuccess }) {
  const [nurseId, setNurseId] = useState('RN A. Collins');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await triageApi.accept(visitId, {
        nurse_id: nurseId.trim() || 'RN-Shift',
        reason: reason.trim() || 'Clinician reviewed and accepted the AI ESI recommendation.',
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to record acceptance. Please try again.');
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
              background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Accept AI Recommendation</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {patientName ? `Patient: ${patientName}` : `Visit #${visitId}`}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
              <div style={{ fontSize: '0.85rem', color: '#14532d' }}>
                Confirming <strong>ESI-{esiLevel}</strong> as the final acuity
                {confidence !== null && confidence !== undefined
                  ? <> with an AI confidence of <strong>{(confidence * 100).toFixed(0)}%</strong>.</>
                  : '.'}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Clinical Review Notes (optional)</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Vital signs consistent with presentation; agrees with AI recommendation."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nurse / Clinician ID</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. RN A. Collins"
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
              />
            </div>

            <div className="info-callout" style={{ marginTop: '0.5rem' }}>
              <ShieldCheck size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
              <span>
                Acceptance is recorded in the permanent institutional audit log with timestamp,
                clinician ID, and AI prediction details.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <CheckCircle2 size={16} /> {loading ? 'Recording...' : 'Confirm Acceptance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
