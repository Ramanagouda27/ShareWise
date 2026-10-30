import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatErrorMessage } from '../lib/errors';
import { getSupabaseClient } from '../services/supabaseClient';
import { isMockAuthMode } from '../services/authService';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError('Enter the email address associated with your account.');
      return;
    }

    if (isMockAuthMode()) {
      setError('Password reset is unavailable in mock mode. Open the Supabase-connected preview.');
      return;
    }

    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase is not configured for password recovery.');
      }

      const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (resetError) throw resetError;

      setSuccessMessage(
        'If an account exists for this address, a password reset email has been requested. Check your inbox and Spam/Junk folder.'
      );
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-neutral-50/50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2.5 group mb-4">
          <img src="/logo.png" alt="ShareWise Logo" className="w-10 h-10 object-contain rounded-xl" />
          <span className="text-2xl font-bold tracking-tight text-neutral-900">ShareWise</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Reset your password</h2>
        <p className="mt-2 text-sm text-neutral-500">We will send a recovery link to your account email.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-neutral-200/90 shadow-xs">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Campus Email Address"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@campus.edu"
              leftIcon={<Mail className="w-4 h-4" />}
            />

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}
            {successMessage && (
              <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {successMessage}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
              Send reset link
            </Button>
          </form>
          <div className="mt-6 text-center text-xs text-neutral-500">
            Remembered your password?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:underline">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
};