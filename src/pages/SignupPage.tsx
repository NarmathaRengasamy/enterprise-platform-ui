import React, { useState } from 'react';
import { Button, Icon } from '../components/common';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types/auth.types';

interface SignupPageProps {
  onSignupSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export default function SignupPage({ onSignupSuccess, onSwitchToLogin }: SignupPageProps) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('Admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        name: fullName.trim(),
        email: email.trim(),
        password,
        department: 'Operations',
        role,
      });
      onSignupSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex items-center justify-center p-space-md relative overflow-hidden">
      {/* Background glow blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-primary-fixed/30 rounded-full blur-3xl -top-40 -left-20 absolute"></div>
        <div className="w-[500px] h-[500px] bg-secondary-fixed/20 rounded-full blur-3xl -bottom-20 -right-20 absolute"></div>
      </div>

      <div className="flex flex-col w-full items-center justify-center py-space-xl px-space-md min-w-0 relative z-10">
        {/* Signup Card */}
        <div className="relative w-full max-w-[500px] bg-surface-container-lowest shadow-xl rounded-2xl p-space-xl flex flex-col min-w-0 transition-all border border-surface-container-high">
          {/* Header & Vector Brand Mark */}
          <div className="flex flex-col items-center text-center mb-space-lg">
            <div className="mb-space-md flex items-center justify-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-blue-500 text-white flex items-center justify-center shadow-md shrink-0">
                <span className="material-symbols-outlined text-2xl">all_inclusive</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="font-headline-sm text-xl text-on-surface tracking-tight font-bold leading-tight">
                  OmniFlow
                </span>
                <span className="text-[11px] text-primary font-bold tracking-wider uppercase">
                  Perfox Assistant
                </span>
              </div>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Create your account
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-space-2xs">
              Start your 14-day free enterprise trial with Perfox AI
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-space-md p-space-sm bg-error-container text-on-error-container rounded-xl text-label-md flex items-center gap-2 border border-error/20 animate-fadeIn">
              <Icon name="error" size="sm" color="error" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="flex flex-col gap-space-md" onSubmit={handleSubmit} autoComplete="off">
            {/* Full Name */}
            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="fullName">
                Full name <span className="text-error">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none select-none flex items-center">
                  <Icon name="person" size="md" color="outline" />
                </span>
                <input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="off"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full h-10 pl-10 pr-4 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="email">
                Work email address <span className="text-error">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none select-none flex items-center">
                  <Icon name="mail" size="md" color="outline" />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-10 pl-10 pr-4 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="role">
                Account Role <span className="text-error">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none select-none flex items-center">
                  <Icon name="shield_person" size="md" color="outline" />
                </span>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full h-10 pl-10 pr-10 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high appearance-none transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="Admin">Admin (Full System &amp; Developer Access)</option>
                  <option value="Editor">Editor (Manage Products, KB &amp; Schedule)</option>
                  <option value="Viewer">Viewer (Read-only Access)</option>
                </select>
                <span className="absolute right-3 pointer-events-none text-outline flex items-center">
                  <Icon name="expand_more" size="md" />
                </span>
              </div>
            </div>

            {/* Password & Confirm Password in 2 cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="password">
                  Password <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 pointer-events-none select-none flex items-center">
                    <Icon name="lock" size="md" color="outline" />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full h-10 pl-10 pr-10 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    className="absolute right-2 p-1.5 rounded text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} size="md" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="confirmPassword">
                  Confirm Password <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 pointer-events-none select-none flex items-center">
                    <Icon name="lock" size="md" color="outline" />
                  </span>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full h-10 pl-10 pr-10 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label="Toggle confirm password visibility"
                    className="absolute right-2 p-1.5 rounded text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <Icon name={showConfirmPassword ? 'visibility_off' : 'visibility'} size="md" />
                  </button>
                </div>
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-2 pt-space-2xs">
              <input
                id="agree-terms"
                type="checkbox"
                required
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-primary accent-primary cursor-pointer shrink-0"
              />
              <label htmlFor="agree-terms" className="font-label-md text-label-md text-on-surface-variant cursor-pointer select-none leading-tight">
                I agree to the{' '}
                <a href="#terms" onClick={(e) => e.preventDefault()} className="text-primary hover:underline font-medium">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" onClick={(e) => e.preventDefault()} className="text-primary hover:underline font-medium">
                  Privacy Policy
                </a>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isLoading}
              endIcon={isLoading ? undefined : 'arrow_forward'}
              className="mt-space-xs"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          {/* Switch to Login */}
          <div className="mt-space-lg text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-title-sm text-title-sm text-primary font-semibold hover:underline ml-1 cursor-pointer bg-transparent border-0 p-0"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-space-md flex items-center gap-space-md text-outline font-caption text-caption">
          <a className="hover:text-on-surface transition-colors" href="#privacy">Privacy Policy</a>
          <span>•</span>
          <a className="hover:text-on-surface transition-colors" href="#terms">Terms of Service</a>
          <span>•</span>
          <a className="hover:text-on-surface transition-colors" href="#help">Help &amp; Support</a>
        </div>
      </div>
    </div>
  );
}
