import React, { useState } from 'react';
import { BRAND_LOGO_URL } from '../data/mockData';
import { Button, Icon } from '../components/common';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('sarah@omniflow.io');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess?.();
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex items-center justify-center p-space-md relative overflow-hidden">
      {/* Background glow blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-primary-fixed/30 rounded-full blur-3xl -top-40 -left-20 absolute"></div>
        <div className="w-[500px] h-[500px] bg-secondary-fixed/20 rounded-full blur-3xl -bottom-20 -right-20 absolute"></div>
      </div>

      <div className="flex flex-col w-full items-center justify-center py-space-xl px-space-md min-w-0 relative z-10">
        {/* Login Card */}
        <div className="relative w-full max-w-[460px] bg-surface-container-lowest shadow-xl rounded-2xl p-space-xl flex flex-col min-w-0 transition-all border border-surface-container-high">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-space-lg">
            <div className="mb-space-md flex items-center justify-center">
              <img
                alt="OmniFlow Brand Logo"
                className="h-10 w-auto object-contain"
                src={BRAND_LOGO_URL}
              />
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Welcome Back
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-space-2xs">
              Sign in to manage your Perfox assistant workspace
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-space-md" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="email">
                Email address
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none select-none flex items-center">
                  <Icon name="mail" size="md" color="outline" />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@omniflow.io"
                  className="w-full h-10 pl-10 pr-4 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-space-2xs">
              <div className="flex items-center justify-between">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none select-none flex items-center">
                  <Icon name="lock" size="md" color="outline" />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                onClick={(e) => { e.preventDefault(); alert("Password reset link sent."); }}
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
              endIcon="arrow_forward"
              className="mt-space-xs"
            >
              Login to Dashboard
            </Button>
          </form>

          {/* Social SSO Divider */}
          <div className="relative flex items-center justify-center my-space-lg">
            <div className="w-full h-[1px] bg-surface-container-high"></div>
            <span className="absolute bg-surface-container-lowest px-space-sm font-caption text-caption uppercase tracking-wider text-outline">
              Or continue with
            </span>
          </div>

          {/* SSO Buttons */}
          <div className="grid grid-cols-2 gap-space-sm">
            <Button
              variant="outline"
              size="md"
              onClick={onLoginSuccess}
              className="w-full gap-2"
            >
              <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" fill="#4285F4"></path>
                <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" fill="#34A853"></path>
                <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" fill="#FBBC05"></path>
                <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335"></path>
              </svg>
              <span>Google</span>
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={onLoginSuccess}
              className="w-full gap-2"
            >
              <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
                <path d="M1 1h10v10H1z" fill="#f35325"></path>
                <path d="M12 1h10v10H12z" fill="#81bc06"></path>
                <path d="M1 12h10v10H1z" fill="#05a6f0"></path>
                <path d="M12 12h10v10H12z" fill="#ffba08"></path>
              </svg>
              <span>Microsoft</span>
            </Button>
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
