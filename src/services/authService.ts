import { User, LoginCredentials, SignupCredentials } from '../types/auth';
import { isSupabaseConfigured, getSupabaseClient } from './supabaseClient';
import { CURRENT_MOCK_STUDENT, CURRENT_MOCK_OWNER } from './mock/mockStore';
import { AppError } from '../lib/errors';

const AUTH_STORAGE_KEY = 'sharewise_auth_user_v1';

class AuthService {
  private currentUser: User | null = null;
  private listeners: Array<(user: User | null) => void> = [];

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        this.currentUser = JSON.parse(saved);
      } else {
        // Default to student for seamless hackathon demo experience
        this.currentUser = CURRENT_MOCK_STUDENT;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
      }
    } catch {
      this.currentUser = CURRENT_MOCK_STUDENT;
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentUser));
    if (this.currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  public onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public async signIn(credentials: LoginCredentials): Promise<User> {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password || '',
      });

      if (error) {
        throw new AppError('AUTH_REQUIRED', error.message);
      }

      if (!data.user) {
        throw new AppError('AUTH_REQUIRED', 'No user found');
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email || credentials.email,
        fullName: data.user.user_metadata?.full_name || credentials.email.split('@')[0],
        role: data.user.user_metadata?.role || 'student',
      };

      this.currentUser = user;
      this.notify();
      return user;
    }

    // Mock Authentication mode
    await new Promise((r) => setTimeout(r, 300));

    if (!credentials.email.includes('@')) {
      throw new AppError('AUTH_REQUIRED', 'Please enter a valid campus email address.');
    }

    const isOwner = credentials.email.toLowerCase().includes('owner') || credentials.email.toLowerCase().includes('vance');
    const user: User = isOwner
      ? { ...CURRENT_MOCK_OWNER, email: credentials.email }
      : {
          ...CURRENT_MOCK_STUDENT,
          email: credentials.email,
          fullName: credentials.email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        };

    this.currentUser = user;
    this.notify();
    return user;
  }

  public async signUp(credentials: SignupCredentials): Promise<User> {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client.auth.signUp({
        email: credentials.email,
        password: credentials.password || '',
        options: {
          data: {
            full_name: credentials.fullName,
            role: credentials.role,
            student_id: credentials.studentId,
            department: credentials.department,
          },
        },
      });

      if (error) {
        throw new AppError('AUTH_REQUIRED', error.message);
      }

      const user: User = {
        id: data.user?.id || `user-${Date.now()}`,
        email: credentials.email,
        fullName: credentials.fullName,
        role: credentials.role,
        studentId: credentials.studentId,
        department: credentials.department,
      };

      this.currentUser = user;
      this.notify();
      return user;
    }

    // Mock Signup
    await new Promise((r) => setTimeout(r, 350));
    const user: User = {
      id: `user-${Date.now()}`,
      email: credentials.email,
      fullName: credentials.fullName,
      role: credentials.role,
      studentId: credentials.studentId || 'STU-NEW',
      department: credentials.department || 'Engineering',
      collegeName: 'Campus Institute of Technology',
    };

    this.currentUser = user;
    this.notify();
    return user;
  }

  public async signOut(): Promise<void> {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        await client.auth.signOut();
      }
    }
    this.currentUser = null;
    this.notify();
  }

  // Switch demo persona instantly (Alex Mercer <-> Prof. Vance)
  public switchDemoRole(role: 'student' | 'owner'): User {
    this.currentUser = role === 'student' ? CURRENT_MOCK_STUDENT : CURRENT_MOCK_OWNER;
    this.notify();
    return this.currentUser;
  }
}

export const authService = new AuthService();
