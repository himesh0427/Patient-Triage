import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientsApi } from '../services/api';
import TopNav from '../components/TopNav';
import { Search, Plus } from 'lucide-react';

export default function PatientsList() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPatients = async () => {
    try {
      const q = searchQuery.trim();
      const shouldSearch = q.length >= 2 || (q.length >= 1 && /\d/.test(q));
      if (shouldSearch) {
        const res = await patientsApi.searchPatients(q);
        setPatients(res.data.results || []);
      } else {
        const res = await patientsApi.listPatients(0, 50);
        setPatients(res.data.patients || []);
      }
    } catch (err) {
      console.error("Failed to load patients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [searchQuery]);

  return (
    <>
      <TopNav
        title="Patient Directory"
        subtitle="Search and view historical patient profiles"
      />

      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input
              type="text"
              className="input-clean"
              placeholder="Search by Name or ID (e.g. P-2 or 2)..."
              style={{ paddingLeft: '2.4rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button className="btn-blue" onClick={() => navigate('/intake')}>
            <Plus size={16} /> New Patient Intake
          </button>
        </div>

        <div className="ui-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Full Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Medical History</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No patients found. Click "+ New Patient Intake" to register an ER arrival.
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary-blue)', fontFamily: 'var(--font-mono)' }}>
                        P-{p.id}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-title)' }}>{p.name}</td>
                      <td>{p.age}</td>
                      <td>{p.gender}</td>
                      <td>
                        <span className={`status-pill ${p.has_history ? 'in-room' : 'discharged'}`}>
                          {p.has_history ? 'History on File' : 'No Prior Records'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        {p.latest_visit_id && (
                          <button
                            className="btn-white"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--primary-blue)' }}
                            onClick={() => navigate(`/visit/${p.latest_visit_id}`)}
                          >
                            View Visit #{p.latest_visit_id}
                          </button>
                        )}
                        <button
                          className="btn-white"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => navigate('/intake')}
                        >
                          New Visit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
