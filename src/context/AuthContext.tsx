import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, LoginCredentials, SignupCredentials } from '../types/auth';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<User>;
  signUp: (credentials: SignupCredentials) => Promise<User>;
  signOut: () => Promise<void>;
  switchDemoRole: (role: 'student' | 'owner') => void;
  isAuthenticated: boolean;
  isOwner: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((updatedUser) => {
      setUser(updatedUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
