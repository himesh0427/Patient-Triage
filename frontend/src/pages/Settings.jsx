import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Settings() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const res = await api.get('/config');
    setConfig(res.data);
  };

  const toggleSurge = async () => {
    await api.post('/config/surge');
    fetchConfig();
  };

  const changeType = async (type) => {
    await api.post(`/config/hospital-type?hospital_type=${type}`);
    fetchConfig();
  };

  if (!config) return <div>Loading...</div>;

  return (
    <div style={{maxWidth:'600px', margin:'0 auto'}}>
      <h1 className="page-title">System Settings</h1>
      
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <h3 style={{marginBottom:'1rem'}}>Operational Mode</h3>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem', background:'var(--bg-dark)', borderRadius:'var(--radius)'}}>
          <div>
            <strong>Surge Mode (3x Volume)</strong>
            <p style={{fontSize:'0.85rem', color:'var(--text-muted)', margin:0}}>Auto-escalates patients exceeding wait times.</p>
          </div>
          <button className={`btn ${config.surge_mode ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleSurge}>
            {config.surge_mode ? 'DEACTIVATE SURGE' : 'ACTIVATE SURGE'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{marginBottom:'1rem'}}>Hospital Type</h3>
        <p style={{marginBottom:'1rem', fontSize:'0.9rem', color:'var(--text-muted)'}}>Urban uses standard 5-level ESI. Rural collapses into 3 actionable tiers.</p>
        <div style={{display:'flex', gap:'1rem'}}>
          <button className={`btn ${config.hospital_type === 'URBAN' ? 'btn-primary' : 'btn-secondary'}`} onClick={()=>changeType('URBAN')}>Urban (5-Level)</button>
          <button className={`btn ${config.hospital_type === 'RURAL' ? 'btn-primary' : 'btn-secondary'}`} onClick={()=>changeType('RURAL')}>Rural (3-Tier)</button>
        </div>
      </div>
    </div>
  );
}
