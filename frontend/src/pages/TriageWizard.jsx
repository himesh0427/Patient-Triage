
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AlertTriangle, ShieldCheck, CheckCircle, Search } from 'lucide-react';

export default function TriageWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gdprChecked, setGdprChecked] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', age: '', gender: 'Female', has_history: false,
    hr: '', sbp: '', dbp: '', rr: '', temp: '', spo2: '',
    symptom_text: '',
    // Red flag answers
    unresponsive: false, bleeding: false, respiratory: false, cardiac: false
  });
  
  const [result, setResult] = useState(null);

  // Step 2 Logic
  const hasRedFlags = formData.unresponsive || formData.bleeding || formData.respiratory || formData.cardiac;

  const handleBypass = async () => {
    if (!gdprChecked) {
      setError("You must acknowledge HIPAA/GDPR compliance.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/triage/bypass', {
        name: formData.name || "Unknown Patient",
        age: formData.age ? parseInt(formData.age) : 40,
        gender: formData.gender,
        condition: "Red Flag Triggered (Automatic ESI 1)"
      });
      setResult(res.data);
      setStep(4);
    } catch (err) {
      setError("Error creating bypass record");
    }
    setLoading(false);
  };

  const submitVitalsAndSymptoms = async () => {
    if (!gdprChecked) {
      setError("You must acknowledge HIPAA/GDPR compliance.");
      return;
    }
    setLoading(true);
    try {
      // 1. Submit Vitals first
      const vRes = await api.post('/triage/vitals-check', {
        name: formData.name, age: parseInt(formData.age), gender: formData.gender, has_history: formData.has_history,
        vitals: {
          hr: parseFloat(formData.hr)||null, sbp: parseFloat(formData.sbp)||null, dbp: parseFloat(formData.dbp)||null,
          rr: parseFloat(formData.rr)||null, temp: parseFloat(formData.temp)||null, spo2: parseFloat(formData.spo2)||null
        }
      });
      
      if (vRes.data.hard_rule_triggered) {
        setResult(vRes.data);
        setStep(4);
        setLoading(false);
        return;
      }
      
      // 2. If no hard rule triggered, submit symptoms for ML Prediction
      const sRes = await api.post(`/triage/symptoms/${vRes.data.visit_id}`, {
        symptom_text: formData.symptom_text || "No chief complaint recorded"
      });
      
      setResult(sRes.data);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.detail || "Error during triage prediction");
    }
    setLoading(false);
  };

  // Age-based threshold warnings for UI
  const getVitalWarning = () => {
    const age = parseInt(formData.age);
    if (!age) return null;
    
    if (age > 65 && parseFloat(formData.spo2) < 92) return "Geriatric SpO2 below 92% detected.";
    if (age < 1 && parseFloat(formData.rr) > 60) return "Infant Tachypnea detected (RR > 60).";
    if (age < 12 && parseFloat(formData.hr) > 180) return "Pediatric Tachycardia detected.";
    return null;
  };

  const warning = getVitalWarning();

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Intake</h1>
          <p style={{color: 'var(--text-muted)'}}>Enter patient information and symptoms</p>
        </div>
        <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
          {[1,2,3,4].map(s => (
            <div key={s} style={{
              width: '30px', height: '30px', borderRadius: '50%', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step === s ? 'var(--brand-primary)' : step > s ? 'var(--success)' : '#e2e8f0',
              color: step >= s ? '#fff' : 'var(--text-muted)',
              fontWeight: 'bold', fontSize: '0.9rem'
            }}>
              {step > s ? <CheckCircle size={16} /> : s}
            </div>
          ))}
        </div>
      </div>
      
      {error && <div className="alert alert-danger">{error}</div>}
      
      <div className="card">
        {step === 1 && (
          <div>
            <h2 style={{fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem'}}>1. Demographics & History</h2>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-control" type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Age *</label>
                <input className="form-control" type="number" value={formData.age} onChange={e=>setFormData({...formData, age: e.target.value})} />
              </div>
            </div>
            
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-control" value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value})}>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group" style={{display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600}}>
                  <input type="checkbox" style={{width: '20px', height: '20px'}} checked={formData.has_history} onChange={e=>setFormData({...formData, has_history: e.target.checked})} />
                  Patient has prior hospital history
                </label>
              </div>
            </div>
            
            <div style={{marginTop: '2rem', display: 'flex', justifyContent: 'flex-end'}}>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!formData.age}>Next: Red Flag Check &rarr;</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', color: 'var(--danger)'}}>
              2. Red Flag Assessment (Critical Safety Check)
            </h2>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem'}}>
              {[
                {k: 'unresponsive', l: 'Is the patient unresponsive?'},
                {k: 'bleeding', l: 'Severe bleeding or major trauma?'},
                {k: 'respiratory', l: 'Severe respiratory distress?'},
                {k: 'cardiac', l: 'Cardiac arrest or near-arrest?'}
              ].map(q => (
                <div key={q.k} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)'}}>
                  <div style={{fontWeight: 600, fontSize: '1.1rem'}}>{q.l}</div>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button className={`btn ${formData[q.k] ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setFormData({...formData, [q.k]: true})}>YES</button>
                    <button className={`btn ${!formData[q.k] ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFormData({...formData, [q.k]: false})}>NO</button>
                  </div>
                </div>
              ))}
            </div>
            
            {hasRedFlags && (
              <div className="alert alert-danger" style={{flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
                <h3 style={{fontSize: '1.5rem', margin: 0}}>CRITICAL - ESI 1</h3>
                <p>Immediate resuscitation required. Proceed to bypass.</p>
              </div>
            )}
            
            <div style={{borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem'}}>
              <label style={{display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)', cursor: 'pointer', marginBottom: '1.5rem'}}>
                <input type="checkbox" checked={gdprChecked} onChange={e=>setGdprChecked(e.target.checked)} style={{width: '24px', height: '24px', marginTop: '2px'}} />
                <div style={{fontSize: '0.9rem'}}>
                  <strong>HIPAA / GDPR Compliance Statement</strong>
                  <div style={{color: 'var(--text-muted)'}}>I confirm that this patient data is collected strictly for emergency triage purposes. The data will be processed securely in accordance with hospital policy and applicable privacy laws.</div>
                </div>
              </label>
              
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <button className="btn btn-secondary" onClick={() => setStep(1)}>&larr; Back</button>
                {hasRedFlags ? (
                  <button className="btn btn-danger" onClick={handleBypass} disabled={loading || !gdprChecked}>
                    {loading ? "Processing..." : "Bypass & Generate ESI 1 Alert"}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!gdprChecked}>
                    Next: Vitals & Symptoms &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem'}}>
              3. Vitals & Symptoms
            </h2>
            
            {warning && (
              <div className="alert alert-danger"><AlertTriangle size={20} /> {warning}</div>
            )}

            <div className="grid-3" style={{background: '#f8fafc', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', marginBottom: '2rem'}}>
              <div className="form-group"><label className="form-label">HR (bpm)</label><input className="form-control" type="number" value={formData.hr} onChange={e=>setFormData({...formData, hr: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">SBP (mmHg)</label><input className="form-control" type="number" value={formData.sbp} onChange={e=>setFormData({...formData, sbp: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">RR (breaths/m)</label><input className="form-control" type="number" value={formData.rr} onChange={e=>setFormData({...formData, rr: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">SpO2 (%)</label><input className="form-control" type="number" value={formData.spo2} onChange={e=>setFormData({...formData, spo2: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Temp (°C)</label><input className="form-control" type="number" step="0.1" value={formData.temp} onChange={e=>setFormData({...formData, temp: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">DBP (mmHg)</label><input className="form-control" type="number" value={formData.dbp} onChange={e=>setFormData({...formData, dbp: e.target.value})} /></div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Chief Complaint & Symptoms</label>
              <div style={{position: 'relative'}}>
                <Search size={20} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)'}} />
                <textarea 
                  className="form-control" 
                  style={{paddingLeft: '40px', minHeight: '100px'}} 
                  placeholder="Type symptoms here (e.g., severe headache with nausea and sensitivity to light)..." 
                  value={formData.symptom_text} 
                  onChange={e=>setFormData({...formData, symptom_text: e.target.value})}
                ></textarea>
              </div>
            </div>
            
            <div style={{marginTop: '2rem', display: 'flex', justifyContent: 'space-between'}}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>&larr; Back</button>
              <button className="btn btn-primary" onClick={submitVitalsAndSymptoms} disabled={loading}>
                {loading ? "Analyzing Data..." : "Generate AI Triage Prediction"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && result && (
          <div style={{textAlign: 'center'}}>
            <h2 style={{fontSize: '1.25rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', textAlign: 'left'}}>
              4. AI Recommendation
            </h2>
            
            {result.alert === 'LOW_CONFIDENCE' && (
              <div className="alert alert-warning" style={{textAlign: 'left'}}>
                <AlertTriangle size={24} />
                <div>
                  <strong>Low Confidence - Review Recommended</strong>
                  <div style={{fontSize: '0.9rem'}}>The AI model is uncertain about this prediction. Consider escalating one level.</div>
                </div>
              </div>
            )}
            
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '3rem'}}>
              <div style={{fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem'}}>
                Recommended ESI Level
              </div>
              <div className={`esi-badge lg esi-${result.esi || 1}`} style={{marginBottom: '1rem'}}>
                {result.esi}
              </div>
              <div style={{fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem'}}>{result.action}</div>
              
              {result.confidence && (
                <div style={{width: '100%', maxWidth: '400px', marginTop: '1.5rem'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 600}}>
                    <span>AI Confidence</span>
                    <span>{(result.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden'}}>
                    <div style={{height: '100%', width: `${result.confidence*100}%`, background: result.confidence > 0.75 ? 'var(--success)' : result.confidence > 0.5 ? 'var(--warning)' : 'var(--danger)'}}></div>
                  </div>
                </div>
              )}
            </div>
            
            <div style={{textAlign: 'left', background: '#f8fafc', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', marginBottom: '2rem'}}>
              <h4 style={{marginBottom: '1rem', fontSize: '1.1rem'}}>Clinical Reasoning</h4>
              <ul style={{paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                {result.reasons.map((r,i) => (
                  <li key={i} style={{fontWeight: 500}}>{r}</li>
                ))}
              </ul>
            </div>
            
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
              <button className="btn btn-secondary">Override Recommendation</button>
              <button className="btn btn-primary" onClick={() => navigate('/queue')}>
                <CheckCircle size={20} /> Confirm & Send to Queue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
