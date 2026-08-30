import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const DEMO_CREDENTIALS = {
  nurse: {
    username: 'nurse',
    email: 'nurse@hospital.org',
    password: 'nurse123',
    name: 'Sarah Jenkins, RN',
    title: 'Staff Nurse',
    badge: 'Nurse',
    role: 'nurse',
    desc: 'Frontline triage, LightGBM ESI scoring, reassessments, overrides & reports.',
  },
  admin: {
    username: 'admin',
    email: 'admin@hospital.org',
    password: 'admin123',
    name: 'Dr. Eleanor Davis, MD',
    title: 'Clinical Director & Administrator',
    badge: 'Administrator',
    role: 'admin',
    desc: 'Full access: Hospital configurations, wait SLAs, audit compliance & system settings.',
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('pt_auth_user') || sessionStorage.getItem('pt_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('pt_auth_token') || sessionStorage.getItem('pt_auth_token') || null;
  });

  const [loading, setLoading] = useState(true);

  // Synchronize on mount with backend /auth/me if token exists
  useEffect(() => {
    if (token) {
      authApi.getMe()
        .then((res) => {
          setUser(res.data);
          if (localStorage.getItem('pt_auth_token')) {
            localStorage.setItem('pt_auth_user', JSON.stringify(res.data));
          } else {
            sessionStorage.setItem('pt_auth_user', JSON.stringify(res.data));
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (usernameOrEmail, password, rememberMe = true) => {
    const res = await authApi.login({
      username_or_email: usernameOrEmail,
      password,
      remember_me: rememberMe,
    });

    const { access_token, user: userData } = res.data;

    setToken(access_token);
    setUser(userData);

    if (rememberMe) {
      localStorage.setItem('pt_auth_token', access_token);
      localStorage.setItem('pt_auth_user', JSON.stringify(userData));
      sessionStorage.removeItem('pt_auth_token');
      sessionStorage.removeItem('pt_auth_user');
    } else {
      sessionStorage.setItem('pt_auth_token', access_token);
      sessionStorage.setItem('pt_auth_user', JSON.stringify(userData));
      localStorage.removeItem('pt_auth_token');
      localStorage.removeItem('pt_auth_user');
    }

    return userData;
  };

  const register = async ({ username, email, password, full_name, role = 'nurse', rememberMe = true }) => {
    const res = await authApi.register({
      username,
      email,
      password,
      full_name,
      role,
    });

    const { access_token, user: userData } = res.data;

    setToken(access_token);
    setUser(userData);

    if (rememberMe) {
      localStorage.setItem('pt_auth_token', access_token);
      localStorage.setItem('pt_auth_user', JSON.stringify(userData));
      sessionStorage.removeItem('pt_auth_token');
      sessionStorage.removeItem('pt_auth_user');
    } else {
      sessionStorage.setItem('pt_auth_token', access_token);
      sessionStorage.setItem('pt_auth_user', JSON.stringify(userData));
      localStorage.removeItem('pt_auth_token');
      localStorage.removeItem('pt_auth_user');
    }

    return userData;
  };

  const logout = async () => {
    try {
      if (token) {
        await authApi.logout();
      }
    } catch (e) {
      console.warn('Logout API notification error:', e);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('pt_auth_token');
      localStorage.removeItem('pt_auth_user');
      sessionStorage.removeItem('pt_auth_token');
      sessionStorage.removeItem('pt_auth_user');
    }
  };

  // Quick 1-click demo role switch helper
  const switchDemoRole = async (targetRole) => {
    const creds = DEMO_CREDENTIALS[targetRole] || DEMO_CREDENTIALS.nurse;
    if (creds) {
      return await login(creds.username, creds.password, true);
    }
  };

  const hasRole = (allowedRoles) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return allowed.includes(user.role);
  };

  const canAccess = (feature) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    switch (feature) {
      case 'hospital_config':
      case 'settings':
      case 'audit_log':
      case 'user_management':
        return user.role === 'admin';

      case 'reports':
      case 'surge':
      case 'overrides':
      case 'dashboard':
      case 'queue':
      case 'intake':
      case 'patients':
      case 'visit_detail':
      case 'alerts':
      case 'reassessment':
      default:
        return true;
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    switchDemoRole,
    hasRole,
    canAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
