import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authService } from '../services/auth.service';
import { getToken } from '../services/client';
import {
  AuthContextType,
  LoginCredentials,
  RegisterData,
  User,
} from '../types/auth.types';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize and hydrate user from token on mount
  const checkAuthStatus = useCallback(async () => {
    const existingToken = getToken();
    if (!existingToken) {
      setUser(null);
      setTokenState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setTokenState(existingToken);
      setError(null);
    } catch (err: any) {
      console.warn('⚠️ [AuthContext] Stored token invalid or expired:', err.message);
      authService.logout();
      setUser(null);
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setError(null);
      const authData = await authService.login(credentials);
      setUser(authData.user);
      setTokenState(authData.token);
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please verify your credentials.';
      setError(msg);
      throw err;
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    try {
      setError(null);
      const authData = await authService.register(data);
      setUser(authData.user);
      setTokenState(authData.token);
    } catch (err: any) {
      const msg = err.message || 'Registration failed. Please try again.';
      setError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setTokenState(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      error,
      login,
      register,
      logout,
      clearError,
    }),
    [user, token, isLoading, error, login, register, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
