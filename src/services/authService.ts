import { User, LoginCredentials, SignupCredentials } from '../types/auth';
import { isSupabaseConfigured, getSupabaseClient } from './supabaseClient';
import { CURRENT_MOCK_STUDENT, CURRENT_MOCK_OWNER } from './mock/mockStore';
import { AppError } from '../lib/errors';

const AUTH_STORAGE_KEY = 'sharewise_auth_user_v1';

export const isMockAuthMode = (): boolean =>
  import.meta.env.VITE_DATA_SOURCE !== 'supabase';

const isSupabaseAuthMode = (): boolean =>
  import.meta.env.VITE_DATA_SOURCE === 'supabase';

class AuthService {
  private currentUser: User | null = null;
  private listeners: Array<(user: User | null) => void> = [];
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private supabaseUnsubscribe: (() => void) | null = null;

  private requireSupabaseClient() {
    if (!isSupabaseConfigured()) {
      throw new AppError(
        'MISSING_CONFIG',
        'Supabase mode is selected, but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.'
      );
    }

    const client = getSupabaseClient();
    if (!client) throw new AppError('MISSING_CONFIG');
    return client;
  }

  // Until the backend confirms the trusted profile lookup, live users default
  // to student in the UI. Do not authorize roles using user-editable metadata.
  private mapSupabaseUser(authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): User {
    const metadata = authUser.user_metadata ?? {};
    const fullName =
      typeof metadata.full_name === 'string' && metadata.full_name.trim()
        ? metadata.full_name
        : (authUser.email?.split('@')[0] ?? 'Student');

    return {
      id: authUser.id,
      email: authUser.email ?? '',
      fullName,
      role: 'student',
      studentId:
        typeof metadata.student_id === 'string' ? metadata.student_id : undefined,
      department:
        typeof metadata.department === 'string' ? metadata.department : undefined,
    };
  }

  private restoreMockSession() {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      this.currentUser = saved ? (JSON.parse(saved) as User) : null;
    } catch {
      this.currentUser = null;
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentUser));

    if (isMockAuthMode()) {
      if (this.currentUser) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      if (isMockAuthMode()) {
        this.restoreMockSession();
        this.initialized = true;
        this.notify();
        return;
      }

      const client = this.requireSupabaseClient();
      const { data, error } = await client.auth.getSession();
      if (error) {
        throw new AppError('AUTH_REQUIRED', error.message);
      }

      this.currentUser = data.session?.user
        ? this.mapSupabaseUser(data.session.user)
        : null;
      this.initialized = true;
      this.notify();

      const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
        this.currentUser = session?.user ? this.mapSupabaseUser(session.user) : null;
        this.notify();
      });

      this.supabaseUnsubscribe = () => authListener.subscription.unsubscribe();
    })();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  public onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentUser);

    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== callback);
    };
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public async signIn(credentials: LoginCredentials): Promise<User> {
    if (isSupabaseAuthMode()) {
      const client = this.requireSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password || '',
      });

      if (error) throw new AppError('AUTH_REQUIRED', error.message);
      if (!data.user) throw new AppError('AUTH_REQUIRED', 'No user found.');

      this.currentUser = this.mapSupabaseUser(data.user);
      this.notify();
      return this.currentUser;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!credentials.email.includes('@')) {
      throw new AppError('AUTH_REQUIRED', 'Please enter a valid campus email address.');
    }

    const isOwner =
      credentials.email.toLowerCase().includes('owner') ||
      credentials.email.toLowerCase().includes('vance');

    const user: User = isOwner
      ? { ...CURRENT_MOCK_OWNER, email: credentials.email }
      : {
          ...CURRENT_MOCK_STUDENT,
          email: credentials.email,
          fullName: credentials.email
            .split('@')[0]
            .replace('.', ' ')
            .replace(/\b\w/g, (character) => character.toUpperCase()),
        };

    this.currentUser = user;
    this.notify();
    return user;
  }

  // Returns null when Supabase accepted the signup but requires email confirmation
  // before an authenticated session exists.
  public async signUp(credentials: SignupCredentials): Promise<User | null> {
    if (isSupabaseAuthMode()) {
      const client = this.requireSupabaseClient();
      const { data, error } = await client.auth.signUp({
        email: credentials.email,
        password: credentials.password || '',
        options: {
          data: {
            full_name: credentials.fullName,
            student_id: credentials.studentId,
            department: credentials.department,
            // This is a request/preference only, not a trusted authorization role.
            requested_role: credentials.role,
          },
        },
      });

      if (error) throw new AppError('AUTH_REQUIRED', error.message);
      if (!data.user) {
        throw new AppError('AUTH_REQUIRED', 'Supabase did not return a user for this signup.');
      }

      this.currentUser = data.session ? this.mapSupabaseUser(data.user) : null;
      this.notify();
      return this.currentUser;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));

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
    if (isSupabaseAuthMode()) {
      const client = this.requireSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) throw new AppError('AUTH_REQUIRED', error.message);
    }

    this.currentUser = null;
    this.notify();
  }

  public switchDemoRole(role: 'student' | 'owner'): User {
    if (!isMockAuthMode()) {
      throw new AppError(
        'AUTH_REQUIRED',
        'Demo role switching is available only when VITE_DATA_SOURCE=mock.'
      );
    }

    this.currentUser = role === 'student' ? CURRENT_MOCK_STUDENT : CURRENT_MOCK_OWNER;
    this.notify();
    return this.currentUser;
  }

  public dispose(): void {
    this.supabaseUnsubscribe?.();
    this.supabaseUnsubscribe = null;
  }
}

export const authService = new AuthService();
