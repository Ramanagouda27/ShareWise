import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Cpu, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatErrorMessage } from '../lib/errors';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/resources';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError('Please enter your campus email address.');
      return;
    }

    setIsLoading(true);
    try {
      await signIn({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoSignIn = async (demoEmail: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await signIn({ email: demoEmail, password: 'demo-password-123' });
      navigate(from, { replace: true });
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
          <img
            src="/logo.png"
            alt="ShareWise Logo"
            className="w-10 h-10 object-contain rounded-xl transition-transform group-hover:scale-105"
          />
          <span className="text-2xl font-bold tracking-tight text-neutral-900">ShareWise</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-xs text-neutral-500">
          Access campus hardware reservations and manage lab checkouts
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-neutral-200/90 shadow-xs">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Campus Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex.mercer@campus.edu"
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <div className="flex justify-end mt-1.5">
                <a href="#" className="text-[11px] text-blue-600 hover:underline">
                  Forgot password?
                </a>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Hackathon Demo Credentials Switcher */}
          <div className="mt-6 pt-6 border-t border-neutral-100">
            <span className="block text-center text-[11px] uppercase font-bold tracking-wider text-neutral-400 mb-3">
              One-Click Demo Access
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickDemoSignIn('alex.mercer@campus.edu')}
                disabled={isLoading}
                className="text-xs"
                leftIcon={<UserCheck className="w-3.5 h-3.5 text-blue-600" />}
              >
                Student Demo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickDemoSignIn('david.vance@campus.edu')}
                disabled={isLoading}
                className="text-xs"
                leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />}
              >
                Lab Owner Demo
              </Button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-neutral-500">
            Don't have an account yet?{' '}
            <Link to="/signup" className="font-semibold text-blue-600 hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
