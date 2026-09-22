import React, { useState } from 'react';
import { Button, Icon } from '../components/common';

interface LoginPageProps {
  onLoginSuccess?: () => void;
  initialMode?: 'login' | 'signup';
}

export default function LoginPage({ onLoginSuccess, initialMode = 'login' }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('sarah@omniflow.io');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [rememberMe, setRememberMe] = useState(true);
  
  // Signup form state
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Common UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess?.();
    }, 400);
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess?.();
    }, 600);
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex items-center justify-center p-space-md relative overflow-hidden">
      {/* Background glow blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-primary-fixed/30 rounded-full blur-3xl -top-40 -left-20 absolute"></div>
        <div className="w-[500px] h-[500px] bg-secondary-fixed/20 rounded-full blur-3xl -bottom-20 -right-20 absolute"></div>
      </div>

      <div className="flex flex-col w-full items-center justify-center py-space-xl px-space-md min-w-0 relative z-10">
        {/* Auth Card */}
        <div className="relative w-full max-w-[480px] bg-surface-container-lowest shadow-xl rounded-2xl p-space-xl flex flex-col min-w-0 transition-all border border-surface-container-high">
          {/* Header & Vector Brand Mark */}
          <div className="flex flex-col items-center text-center mb-space-md">
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
              {mode === 'login' ? 'Welcome Back' : 'Create your account'}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-space-2xs">
              {mode === 'login'
                ? 'Sign in to manage your Perfox assistant workspace'
                : 'Start your 14-day free enterprise trial with Perfox AI'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex p-1 mb-space-md bg-surface-container-low rounded-xl border border-surface-container-high">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 text-label-md font-semibold rounded-lg transition-all text-center cursor-pointer ${
                mode === 'login'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2 text-label-md font-semibold rounded-lg transition-all text-center cursor-pointer ${
                mode === 'signup'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-space-md p-space-sm bg-error-container text-on-error-container rounded-xl text-label-md flex items-center gap-2 border border-error/20 animate-fadeIn">
              <Icon name="error" size="sm" color="error" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' ? (
            <form className="flex flex-col gap-space-md" onSubmit={handleLoginSubmit}>
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="login-email">
                  Email address
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 pointer-events-none select-none flex items-center">
                    <Icon name="mail" size="md" color="outline" />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="sarah@omniflow.io"
                    className="w-full h-10 pl-10 pr-4 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-space-2xs">
                <div className="flex items-center justify-between">
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="login-password">
                    Password
                  </label>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 pointer-events-none select-none flex items-center">
                    <Icon name="lock" size="md" color="outline" />
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
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

              <div className="flex items-center justify-between pt-space-2xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                  />
                  <span className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors">
                    Remember me
                  </span>
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => { e.preventDefault(); alert("Password reset link sent to your email."); }}
                  className="font-label-md text-label-md text-primary font-semibold hover:underline focus:outline-none"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isLoading}
                endIcon={isLoading ? undefined : 'arrow_forward'}
                className="mt-space-xs"
              >
                {isLoading ? 'Signing in...' : 'Login to Dashboard'}
              </Button>
            </form>
          ) : (
            /* Signup Form */
            <form className="flex flex-col gap-space-md" onSubmit={handleSignupSubmit}>
              {/* Full Name */}
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="signup-name">
                  Full name <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 pointer-events-none select-none flex items-center">
                    <Icon name="person" size="md" color="outline" />
                  </span>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Sarah Jenkins"
                    className="w-full h-10 pl-10 pr-4 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Work Email */}
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="signup-email">
                  Work email address <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 pointer-events-none select-none flex items-center">
                    <Icon name="mail" size="md" color="outline" />
                  </span>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="sarah@company.com"
                    className="w-full h-10 pl-10 pr-4 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Workspace Name */}
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="signup-workspace">
                  Workspace / Organization
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 pointer-events-none select-none flex items-center">
                    <Icon name="domain" size="md" color="outline" />
                  </span>
                  <input
                    id="signup-workspace"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full h-10 pl-10 pr-4 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="signup-pwd">
                    Password <span className="text-error">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 pointer-events-none select-none flex items-center">
                      <Icon name="lock" size="md" color="outline" />
                    </span>
                    <input
                      id="signup-pwd"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Min 8 chars"
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
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="signup-confirm-pwd">
                    Confirm <span className="text-error">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 pointer-events-none select-none flex items-center">
                      <Icon name="lock" size="md" color="outline" />
                    </span>
                    <input
                      id="signup-confirm-pwd"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter"
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

              {/* Terms Checkbox */}
              <div className="flex items-start gap-2 pt-space-2xs">
                <input
                  id="signup-agree"
                  type="checkbox"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-primary accent-primary cursor-pointer shrink-0"
                />
                <label htmlFor="signup-agree" className="font-label-md text-label-md text-on-surface-variant cursor-pointer select-none leading-tight">
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
          )}

          {/* Toggle link between login and signup */}
          <div className="mt-space-lg text-center">
            {mode === 'login' ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); }}
                  className="font-title-sm text-title-sm text-primary font-semibold hover:underline ml-1 cursor-pointer bg-transparent border-0 p-0"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="font-body-md text-body-md text-on-surface-variant">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="font-title-sm text-title-sm text-primary font-semibold hover:underline ml-1 cursor-pointer bg-transparent border-0 p-0"
                >
                  Sign in
                </button>
              </p>
            )}
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
