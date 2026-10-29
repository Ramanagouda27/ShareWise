
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Building,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import type { UserRole } from '../types/auth';
import { formatErrorMessage } from '../lib/errors';
import { isMockAuthMode } from '../services/authService';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const showDemoRoleSelection = isMockAuthMode();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!fullName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password should be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const createdUser = await signUp({
        fullName,
        email,
        password,
        role,
        studentId: studentId || undefined,
        department: department || undefined,
      });

      if (createdUser) {
        navigate('/resources');
      } else {
        setSuccessMessage(
          'Your account was created. Check your email for the confirmation link, then sign in.'
        );
      }
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
          <span className="text-2xl font-bold tracking-tight text-neutral-900">
            ShareWise
          </span>
        </Link>

        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
          Create your account
        </h2>

        <p className="mt-2 text-xs text-neutral-500">
          Join campus students and lab managers sharing hardware
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-neutral-200/90 shadow-xs">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Full Name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Mercer"
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Campus Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex.mercer@campus.edu"
              leftIcon={<Mail className="w-4 h-4" />}
            />

            {showDemoRoleSelection ? (
              <Select
                label="Account Role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                options={[
                  { label: 'Student Borrower', value: 'student' },
                  { label: 'Lab Custodian / Owner', value: 'owner' },
                ]}
              />
            ) : (
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
                New live accounts start with student access. Lab owner permissions
                must be assigned by the authorized backend/admin workflow.
              </div>
            )}

            {role === 'student' ? (
              <Input
                label="Student ID Number"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="STU-2024-XXXX"
                leftIcon={<BadgeCheck className="w-4 h-4" />}
              />
            ) : null}

            <Input
              label="Academic Department"
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Electrical & Computer Engineering"
              leftIcon={<Building className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 hover:text-neutral-700"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              }
            />

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {successMessage}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-neutral-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-blue-600 hover:underline"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
