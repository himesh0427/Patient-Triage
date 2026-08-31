import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [visit, setVisit] = useState(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ new_esi: 3, reason: '', nurse_id: 'nurse_123' });

  useEffect(() => {
    fetchVisit();
  }, [id]);

  const fetchVisit = async () => {
    try {
      const res = await api.get(`/triage/visit/${id}`);
      setVisit(res.data);
      setOverrideForm(prev => ({...prev, new_esi: res.data.esi_final}));
    } catch (err) {
      console.error(err);
    }
  };

  const handleOverride = async () => {
    try {
      await api.put(`/override/visit/${id}`, overrideForm);
      setShowOverride(false);
      fetchVisit();
    } catch (err) {
      alert("Error overriding");
    }
  };

  const handleDischarge = async () => {
    try {
      await api.post(`/triage/discharge/${id}`);
      navigate('/queue');
    } catch (err) {
      alert("Error discharging");
    }
  };

  if (!visit) return <div>Loading...</div>;

  return (
    <div style={{maxWidth: '800px', margin: '0 auto'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
        <h1 className="page-title" style={{margin:0}}>Visit #{visit.visit_id} - {visit.patient.name}</h1>
        <div>
          <span className={`badge badge-esi-${visit.esi_final}`} style={{fontSize:'1rem', padding:'0.4rem 1rem'}}>ESI {visit.esi_final}</span>
        </div>
      </div>

      <div className="grid-2" style={{marginBottom:'1.5rem'}}>
        <div className="card">
          <h3 className="form-label" style={{borderBottom:'1px solid var(--border-color)', paddingBottom:'0.5rem'}}>Patient Info</h3>
          <div style={{marginTop:'1rem'}}>
            <p><strong>Age:</strong> {visit.patient.age}</p>
            <p><strong>Gender:</strong> {visit.patient.gender}</p>
            <p><strong>Arrival:</strong> {visit.arrival_time}</p>
            <p><strong>Status:</strong> {visit.is_active ? 'In Queue' : 'Discharged'}</p>
          </div>
        </div>
        <div className="card">
          <h3 className="form-label" style={{borderBottom:'1px solid var(--border-color)', paddingBottom:'0.5rem'}}>Vitals</h3>
          <div className="grid-2" style={{marginTop:'1rem', gap:'0.5rem'}}>
            <div><strong>HR:</strong> {visit.vitals.hr || '-'}</div>
            <div><strong>SBP:</strong> {visit.vitals.sbp || '-'}</div>
            <div><strong>SpO2:</strong> {visit.vitals.spo2 || '-'}%</div>
            <div><strong>RR:</strong> {visit.vitals.rr || '-'}</div>
            <div><strong>Temp:</strong> {visit.vitals.temp || '-'}°C</div>
            <div><strong>DBP:</strong> {visit.vitals.dbp || '-'}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:'1.5rem'}}>
        <h3 className="form-label" style={{borderBottom:'1px solid var(--border-color)', paddingBottom:'0.5rem'}}>Clinical AI Assessment</h3>
        <div style={{marginTop:'1rem'}}>
          <p style={{marginBottom:'0.5rem'}}><strong>Symptoms:</strong> {visit.symptom_text || "None recorded"}</p>
          <div style={{background:'var(--bg-dark)', padding:'1rem', borderRadius:'var(--radius)'}}>
            <p><strong>Confidence:</strong> {visit.confidence ? (visit.confidence * 100).toFixed(0) + '%' : 'N/A'}</p>
            <p style={{marginTop:'0.5rem'}}><strong>Reasons:</strong></p>
            <ul style={{paddingLeft:'1.5rem', marginTop:'0.5rem'}}>
              {visit.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {showOverride ? (
        <div className="card alert-warning" style={{marginBottom:'1.5rem'}}>
          <h3 style={{marginBottom:'1rem'}}>Override ESI</h3>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">New ESI Level</label>
              <select className="form-control" value={overrideForm.new_esi} onChange={e=>setOverrideForm({...overrideForm, new_esi: parseInt(e.target.value)})}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nurse ID</label>
              <input type="text" className="form-control" value={overrideForm.nurse_id} onChange={e=>setOverrideForm({...overrideForm, nurse_id: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason</label>
            <input type="text" className="form-control" value={overrideForm.reason} onChange={e=>setOverrideForm({...overrideForm, reason: e.target.value})} />
          </div>
          <div style={{display:'flex', gap:'1rem'}}>
            <button className="btn btn-primary" onClick={handleOverride}>Submit Override</button>
            <button className="btn btn-secondary" onClick={()=>setShowOverride(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{display:'flex', gap:'1rem', marginBottom:'1.5rem'}}>
          <button className="btn btn-secondary" onClick={()=>setShowOverride(true)}>Override ESI</button>
          {visit.is_active && <button className="btn btn-danger" onClick={handleDischarge}>Discharge Patient</button>}
        </div>
      )}

      <div className="card">
        <h3 className="form-label" style={{borderBottom:'1px solid var(--border-color)', paddingBottom:'0.5rem'}}>Audit Trail</h3>
        <div style={{marginTop:'1rem', display:'flex', flexDirection:'column', gap:'1rem'}}>
          {visit.audit_trail.map((log, i) => (
            <div key={i} style={{fontSize:'0.9rem', background:'var(--bg-dark)', padding:'0.8rem', borderRadius:'var(--radius)'}}>
              <div style={{color:'var(--text-muted)', marginBottom:'0.25rem'}}>{log.timestamp}</div>
              <div><strong>{log.action}</strong>: {log.old_value} &rarr; {log.new_value}</div>
              <div style={{color:'var(--brand-primary)', marginTop:'0.25rem'}}>{log.reason}</div>
            </div>
          ))}
          {visit.audit_trail.length === 0 && <div style={{color:'var(--text-muted)'}}>No audit logs found.</div>}
        </div>
      </div>
    </div>
  );
}
