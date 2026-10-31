
import React, { useEffect, useState } from 'react';
import type { User, LoginCredentials, SignupCredentials } from '../types/auth';
import { authService, isMockAuthMode } from '../services/authService';
import { AuthContext } from './authContextValue';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    let initialized = false;

    const unsubscribe = authService.onAuthStateChange((updatedUser) => {
      if (!active) return;
      setUser(updatedUser);
      if (initialized) setIsLoading(false);
    });

    void authService.initialize()
      .then(() => {
        if (!active) return;
        initialized = true;
        setUser(authService.getCurrentUser());
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('[ShareWise] Failed to initialize authentication:', error);
        if (active) {
          initialized = true;
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      return await authService.signIn(credentials);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (credentials: SignupCredentials) => {
    setIsLoading(true);
    try {
      return await authService.signUp(credentials);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoRole = (role: 'student' | 'owner') => {
    if (!isMockAuthMode()) return;
    const updated = authService.switchDemoRole(role);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
        switchDemoRole,
        isAuthenticated: !!user,
        isOwner: user?.role === 'owner' || user?.role === 'admin',
        isStudent: user?.role === 'student',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
