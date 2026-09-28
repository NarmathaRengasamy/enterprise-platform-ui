import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

/**
 * The customer-facing shell.
 *
 * Nothing from the admin layout appears here — no sidebar, no user menu, no
 * auth. These routes sit outside the authenticated tree entirely, so a shopper
 * who has never logged in sees a plain shop.
 */

export const StoreShell: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const onProducts = pathname.startsWith('/store/product');

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-6">
          <Link to="/store" className="flex items-center gap-2.5 group">
            <span className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
              PM
            </span>
            <span className="font-bold text-lg tracking-tight group-hover:text-slate-600 transition-colors">
              Pradeep Mobiles
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link
              to="/store"
              className={`px-3 py-2 rounded-lg transition-colors ${
                pathname === '/store' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Home
            </Link>
            <Link
              to="/store/products"
              className={`px-3 py-2 rounded-lg transition-colors ${
                onProducts || pathname === '/store/products'
                  ? 'text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Shop
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children ?? <Outlet />}</main>

      <footer className="border-t border-slate-200 mt-20">
        <div className="max-w-6xl mx-auto px-5 py-10 text-sm text-slate-500 flex flex-col sm:flex-row gap-3 justify-between">
          <span>© 2026 Pradeep Mobiles — phones and repairs.</span>
          <span className="text-slate-400">
            Prices include listed charges. Repairs are quoted after inspection.
          </span>
        </div>
      </footer>
    </div>
  );
};

/* ------------------------------------------------------------- shared */

export const StoreLoading: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2.5 py-32 text-slate-400">
    <span className="w-2 h-2 rounded-full bg-slate-900 animate-ping" />
    <span className="text-sm">{label}</span>
  </div>
);

export const StoreError: React.FC<{ message?: string | null }> = ({ message }) =>
  message ? (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
        {message}
      </div>
    </div>
  ) : null;

/**
 * The availability line.
 *
 * "Availability not tracked" is an internal phrase — a shopper should simply
 * see nothing rather than be told about the shop's bookkeeping.
 */
export const StockLine: React.FC<{ label?: string; available?: boolean }> = ({
  label,
  available,
}) => {
  if (!label || label === 'Availability not tracked' || label === 'No items configured') {
    return null;
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        available ? 'text-emerald-600' : 'text-slate-400'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-300'}`}
      />
      {label}
    </span>
  );
};

export default StoreShell;
