
import { createContext } from 'react';
import type { User, LoginCredentials, SignupCredentials } from '../types/auth';

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<User>;
  signUp: (credentials: SignupCredentials) => Promise<User | null>;
  signOut: () => Promise<void>;
  switchDemoRole: (role: 'student' | 'owner') => void;
  isAuthenticated: boolean;
  isOwner: boolean;
  isStudent: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
