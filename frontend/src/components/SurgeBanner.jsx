import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, AlertTriangle } from 'lucide-react';

// Requirement #10: 3× Surge Mode must be visible across Dashboard, Queue,
// Alerts, and Settings. Reuse this banner everywhere surge is active.
export default function SurgeBanner({ active = false, scale = 3, compact = false }) {
  const navigate = useNavigate();
  if (!active) return null;

  return (
    <div className="surge-banner">
      <div className="surge-banner-left">
        <div
          style={{
            width: '36px', height: '36px', borderRadius: '8px', background: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Radio size={20} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <strong>3× Surge Protocol Active</strong>
            <span className="surge-badge is-on"><AlertTriangle size={11} /> SURGE</span>
          </div>
          {!compact && (
            <p>
              Safe reassessment intervals are reduced and patients auto-escalate when their
              reduced wait limit is exceeded. All staff should prioritize reassessment of ESI-1/2.
            </p>
          )}
        </div>
      </div>
      <button
        className="btn"
        style={{ background: '#ffffff', color: '#b91c1c', borderColor: '#ffffff', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700 }}
        onClick={() => navigate('/queue')}
      >
        Manage Queue →
      </button>
    </div>
  );
}
