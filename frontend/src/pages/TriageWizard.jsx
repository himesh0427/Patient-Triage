import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function TriageWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    patient_id: null, name: '', age: '', gender: 'Other',
    condition: '', hr: '', sbp: '', dbp: '', rr: '', temp: '', spo2: '',
    symptom_text: ''
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleBypass = async () => {
    setLoading(true);
    try {
      const res = await api.post('/triage/bypass', {
        name: formData.name || "Unknown Patient",
        age: formData.age ? parseInt(formData.age) : 40,
        gender: formData.gender,
        condition: formData.condition || "Immediate Life Threat"
      });
      setResult(res.data);
      setStep(5);
    } catch (err) {
      setError("Error bypassing");
    }
    setLoading(false);
  };

  const handleVitals = async () => {
    setLoading(true);
    try {
      const res = await api.post('/triage/vitals-check', {
        name: formData.name, age: parseInt(formData.age), gender: formData.gender,
        vitals: {
          hr: parseFloat(formData.hr)||null, sbp: parseFloat(formData.sbp)||null,
          dbp: parseFloat(formData.dbp)||null, rr: parseFloat(formData.rr)||null,
          temp: parseFloat(formData.temp)||null, spo2: parseFloat(formData.spo2)||null
        }
      });
      if (res.data.hard_rule_triggered) {
        setResult(res.data);
        setStep(5);
      } else {
        setFormData({...formData, visit_id: res.data.visit_id});
        setStep(4);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Error");
    }
    setLoading(false);
  };

  const handleSymptoms = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/triage/symptoms/${formData.visit_id}`, {
        symptom_text: formData.symptom_text
      });
      setResult(res.data);
      setStep(5);
    } catch (err) {
      setError("Error submitting symptoms");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 className="page-title">Triage Wizard - Step {step}</h1>
      {error && <div className="alert-banner alert-danger">{error}</div>}
      
      <div className="card">
        {step === 1 && (
          <div>
            <h2 style={{marginBottom:'1rem'}}>Patient Demographics</h2>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-control" type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Age</label>
                <input className="form-control" type="number" value={formData.age} onChange={e=>setFormData({...formData, age: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-control" value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value})}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setStep(2)}>Next: Immediate Life Threat Gate</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{marginBottom:'1rem', color:'var(--danger)'}}>Immediate Life Threat Gate</h2>
            <p style={{marginBottom:'1.5rem'}}>Is the patient unconscious, in cardiac arrest, or heavily bleeding?</p>
            <div className="form-group">
              <label className="form-label">Condition (if yes)</label>
              <input className="form-control" type="text" placeholder="e.g. cardiac arrest" value={formData.condition} onChange={e=>setFormData({...formData, condition: e.target.value})} />
            </div>
            <div style={{display:'flex', gap:'1rem'}}>
              <button className="btn btn-danger" onClick={handleBypass} disabled={loading}>YES (Fast-Track ESI 1)</button>
              <button className="btn btn-secondary" onClick={() => setStep(3)}>NO (Proceed to Vitals)</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{marginBottom:'1rem'}}>Vital Signs</h2>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">HR (bpm)</label><input className="form-control" type="number" value={formData.hr} onChange={e=>setFormData({...formData, hr: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">SBP (mmHg)</label><input className="form-control" type="number" value={formData.sbp} onChange={e=>setFormData({...formData, sbp: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">SpO2 (%)</label><input className="form-control" type="number" value={formData.spo2} onChange={e=>setFormData({...formData, spo2: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Temp (°C)</label><input className="form-control" type="number" step="0.1" value={formData.temp} onChange={e=>setFormData({...formData, temp: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">RR (breaths/min)</label><input className="form-control" type="number" value={formData.rr} onChange={e=>setFormData({...formData, rr: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">DBP (mmHg)</label><input className="form-control" type="number" value={formData.dbp} onChange={e=>setFormData({...formData, dbp: e.target.value})} /></div>
            </div>
            <button className="btn btn-primary" onClick={handleVitals} disabled={loading}>Submit Vitals & Check Rules</button>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 style={{marginBottom:'1rem'}}>Symptoms (Chief Complaints)</h2>
            <div className="form-group">
              <label className="form-label">Describe symptoms in plain text</label>
              <textarea className="form-control" rows="4" placeholder="e.g. crushing chest pain radiating to jaw, nauseous for 2 hours" value={formData.symptom_text} onChange={e=>setFormData({...formData, symptom_text: e.target.value})}></textarea>
            </div>
            <button className="btn btn-primary" onClick={handleSymptoms} disabled={loading}>Run AI Prediction</button>
          </div>
        )}

        {step === 5 && result && (
          <div style={{ textAlign: 'center' }}>
            {result.alert === 'LOW_CONFIDENCE' && (
              <div className="alert-banner alert-warning" style={{textAlign:'left'}}>Model is uncertain. Please review before assigning a bed.</div>
            )}
            <h2 style={{marginBottom:'0.5rem'}}>Recommended ESI</h2>
            <div style={{fontSize:'4rem', fontWeight:'bold', color:`var(--esi-${result.esi || 1})`}}>{result.esi}</div>
            <div style={{marginBottom:'1.5rem', fontWeight:'500'}}>{result.action}</div>
            
            {result.confidence && (
              <div style={{marginBottom:'1.5rem'}}>
                <div className="form-label">Confidence: {(result.confidence * 100).toFixed(0)}%</div>
                <div style={{height:'8px', background:'var(--bg-dark)', borderRadius:'4px', overflow:'hidden', margin:'0 auto', width:'80%'}}>
                  <div style={{height:'100%', width:`${result.confidence*100}%`, background:'var(--brand-primary)'}}></div>
                </div>
              </div>
            )}
            
            <div style={{textAlign:'left', background:'var(--bg-dark)', padding:'1rem', borderRadius:'var(--radius)', marginBottom:'1.5rem'}}>
              <h4 style={{marginBottom:'0.5rem', color:'var(--text-muted)'}}>Reasons:</h4>
              <ul style={{paddingLeft:'1.5rem'}}>
                {result.reasons.map((r,i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            
            <div style={{display:'flex', gap:'1rem', justifyContent:'center'}}>
              <button className="btn btn-primary" onClick={() => navigate('/queue')}>Accept & Go to Queue</button>
              <button className="btn btn-secondary" onClick={() => navigate(`/visit/${result.visit_id}`)}>View / Override</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
