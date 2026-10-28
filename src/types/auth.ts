export type UserRole = 'student' | 'owner' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  studentId?: string;
  department?: string;
  collegeName?: string;
  avatarUrl?: string;
}

export interface AuthSession {
  user: User | null;
  accessToken?: string;
  isLoading: boolean;
  error?: string | null;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface SignupCredentials {
  email: string;
  password?: string;
  fullName: string;
  role: UserRole;
  studentId?: string;
  department?: string;
}
