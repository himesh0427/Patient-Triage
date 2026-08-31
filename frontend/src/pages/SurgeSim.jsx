import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function SurgeSim() {
  const navigate = useNavigate();
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSimulate = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await api.post(`/triage/surge/simulate?scale=${scale}`);
      setMsg(res.data.message);
    } catch(err) {
      setMsg("Error generating patients");
    }
    setLoading(false);
  };

  return (
    <div style={{maxWidth:'600px', margin:'0 auto'}}>
      <h1 className="page-title">Surge Simulator</h1>
      
      <div className="card">
        <p style={{marginBottom:'1.5rem', color:'var(--text-muted)'}}>
          Instantly generate dozens of patients to test queue sorting and auto-escalation in Surge Mode.
        </p>
        
        <div className="form-group">
          <label className="form-label">Scale (1 = 30 patients)</label>
          <input type="range" min="1" max="5" className="form-control" value={scale} onChange={e=>setScale(e.target.value)} />
          <div style={{marginTop:'0.5rem', fontWeight:'bold'}}>{scale * 30} Patients</div>
        </div>
        
        <div style={{display:'flex', gap:'1rem'}}>
          <button className="btn btn-danger" onClick={handleSimulate} disabled={loading}>
            {loading ? "Generating..." : "Generate Test Patients"}
          </button>
          {msg && <button className="btn btn-primary" onClick={()=>navigate('/queue')}>Go to Queue</button>}
        </div>
        
        {msg && <div style={{marginTop:'1.5rem', color:'var(--success)', fontWeight:'bold'}}>{msg}</div>}
      </div>
    </div>
  );
}
