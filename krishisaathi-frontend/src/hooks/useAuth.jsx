import { createContext, useContext, useMemo, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ks_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem('ks_token'));

  const login = useCallback((user_data, auth_token) => {
    localStorage.setItem('ks_user', JSON.stringify(user_data));
    localStorage.setItem('ks_token', auth_token);
    setUser(user_data);
    setToken(auth_token);
  }, []);

  const updateUser = useCallback((user_data) => {
    localStorage.setItem('ks_user', JSON.stringify(user_data));
    setUser(user_data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ks_user');
    localStorage.removeItem('ks_token');
    localStorage.removeItem('ks_needs_onboarding');
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      is_authenticated: Boolean(token),
      login,
      updateUser,
      logout,
    }),
    [user, token, login, updateUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
