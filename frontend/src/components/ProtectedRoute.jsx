import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccessRestricted from './AccessRestricted';

export default function ProtectedRoute({ children, requiredRoles = null }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <div className="pulse-alert" style={{ fontSize: '1rem', fontWeight: 600 }}>
          Authenticating clinical session...
        </div>
      </div>
    );
  }

  // Not logged in -> redirect to /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check
  if (requiredRoles && !hasRole(requiredRoles)) {
    return <AccessRestricted requiredRoles={requiredRoles} />;
  }

  return children;
}
