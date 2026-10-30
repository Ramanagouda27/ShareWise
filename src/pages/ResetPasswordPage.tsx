import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatErrorMessage } from '../lib/errors';
import { getSupabaseClient } from '../services/supabaseClient';
import { isMockAuthMode } from '../services/authService';

export const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    if (isMockAuthMode()) {
      setError('Password recovery is available only in Supabase mode.');
      return;
    }

    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase is not configured for password recovery.');
      }

      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        const message = updateError.message.toLowerCase();
        if (message.includes('session') || message.includes('token') || message.includes('auth')) {
          throw new Error('This reset link is invalid or expired. Request a new reset email and open the newest link.');
        }
        throw updateError;
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
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
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Choose a new password</h2>
        <p className="mt-2 text-sm text-neutral-500">Open the recovery link from your email before setting a new password.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-neutral-200/90 shadow-xs">
          {success ? (
            <div className="space-y-4">
              <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                Your password has been updated. Sign in with your new password.
              </div>
              <Link to="/login" className="block text-center font-semibold text-blue-600 hover:underline">Go to Sign In</Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="New Password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                leftIcon={<Lock className="w-4 h-4" />}
              />
              <Input
                label="Confirm New Password"
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter new password"
                leftIcon={<Lock className="w-4 h-4" />}
              />
              {error && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {error}
                </div>
              )}
              <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                Update Password
              </Button>
            </form>
          )}
          {!success && (
            <div className="mt-6 text-center text-xs text-neutral-500">
              Need another link?{' '}
              <Link to="/forgot-password" className="font-semibold text-blue-600 hover:underline">Request a new reset link</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};