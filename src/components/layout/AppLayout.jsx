import React, { useState } from 'react';
import { BRAND_LOGO_URL, USER_AVATAR_URL } from '../../data/mockData';

export default function AppLayout({ activeModule, setActiveModule, children, onLogout, notificationsCount = 1 }) {
  const [productsSubmenuOpen, setProductsSubmenuOpen] = useState(
    activeModule === 'products' || activeModule === 'categories' || activeModule === 'add-product' || activeModule === 'product-details'
  );
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isProductsActive = activeModule === 'products' || activeModule === 'categories' || activeModule === 'add-product' || activeModule === 'product-details';

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      {/* Persistent Collapsible Sidebar (240px Desktop) */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between select-none">
        <div className="flex flex-col">
          {/* Logo & Brand */}
          <div 
            className="h-16 px-space-md flex items-center gap-space-xs cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setActiveModule('dashboard')}
          >
            <img 
              alt="OmniFlow Brand Logo" 
              className="h-8 w-auto object-contain" 
              src={BRAND_LOGO_URL} 
            />
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">OmniFlow</span>
              <span className="text-[10px] text-primary font-semibold tracking-wider uppercase -mt-1">Perfox Assistant</span>
            </div>
          </div>

          {/* Main Navigation Menu */}
          <div className="px-space-md pt-space-xs">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider px-space-xs block mb-space-2xs">
              Main Menu
            </span>
            <nav className="flex flex-col gap-1">
              {/* 1. Dashboard */}
              <button
                type="button"
                onClick={() => setActiveModule('dashboard')}
                className={`w-full flex items-center gap-space-xs px-space-xs py-space-xs rounded-xl font-body-sm text-body-sm transition-all text-left ${
                  activeModule === 'dashboard'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg">dashboard</span>
                <span>Dashboard</span>
              </button>

              {/* 2. Conversations */}
              <button
                type="button"
                onClick={() => setActiveModule('conversations')}
                className={`w-full flex items-center justify-between px-space-xs py-space-xs rounded-xl font-body-sm text-body-sm transition-all text-left ${
                  activeModule === 'conversations'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-lg">chat</span>
                  <span>Conversations</span>
                </div>
                <span className="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-primary text-on-primary">
                  3
                </span>
              </button>

              {/* 3. Products Submenu */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setProductsSubmenuOpen(!productsSubmenuOpen)}
                  className={`w-full flex items-center justify-between px-space-xs py-space-xs rounded-xl font-body-sm text-body-sm transition-all text-left ${
                    isProductsActive
                      ? 'text-on-surface font-semibold hover:bg-surface-container-high'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-space-xs">
                    <span className={`material-symbols-outlined text-lg ${isProductsActive ? 'text-primary' : ''}`}>inventory_2</span>
                    <span>Products</span>
                  </div>
                  <span className={`material-symbols-outlined text-base text-outline transition-transform duration-200 ${productsSubmenuOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {productsSubmenuOpen && (
                  <div className="flex flex-col gap-1 pl-6 ml-2">
                    {/* 3.1 All Products */}
                    <button
                      type="button"
                      onClick={() => setActiveModule('products')}
                      className={`w-full flex items-center gap-space-xs px-space-xs py-1.5 rounded-lg font-body-sm text-body-sm transition-all text-left ${
                        activeModule === 'products' || activeModule === 'add-product' || activeModule === 'product-details'
                          ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${activeModule === 'products' || activeModule === 'add-product' || activeModule === 'product-details' ? 'bg-primary-fixed-dim' : 'bg-outline/40'}`} />
                      <span>All Products</span>
                    </button>

                    {/* 3.2 Categories */}
                    <button
                      type="button"
                      onClick={() => setActiveModule('categories')}
                      className={`w-full flex items-center gap-space-xs px-space-xs py-1.5 rounded-lg font-body-sm text-body-sm transition-all text-left ${
                        activeModule === 'categories'
                          ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${activeModule === 'categories' ? 'bg-primary-fixed-dim' : 'bg-outline/40'}`} />
                      <span>Categories</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Schedule */}
              <button
                type="button"
                onClick={() => setActiveModule('schedule')}
                className={`w-full flex items-center gap-space-xs px-space-xs py-space-xs rounded-xl font-body-sm text-body-sm transition-all text-left ${
                  activeModule === 'schedule' || activeModule === 'calendar'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg">calendar_month</span>
                <span>Schedule</span>
              </button>

              {/* 5. Knowledge Base */}
              <button
                type="button"
                onClick={() => setActiveModule('knowledge-base')}
                className={`w-full flex items-center gap-space-xs px-space-xs py-space-xs rounded-xl font-body-sm text-body-sm transition-all text-left ${
                  activeModule === 'knowledge-base'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg">menu_book</span>
                <span>Knowledge Base</span>
              </button>

              {/* 6. Teams */}
              <button
                type="button"
                onClick={() => setActiveModule('teams')}
                className={`w-full flex items-center gap-space-xs px-space-xs py-space-xs rounded-xl font-body-sm text-body-sm transition-all text-left ${
                  activeModule === 'teams'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg">groups</span>
                <span>Teams</span>
              </button>

              {/* 7. Developer */}
              <button
                type="button"
                onClick={() => setActiveModule('developer')}
                className={`w-full flex items-center gap-space-xs px-space-xs py-space-xs rounded-xl font-body-sm text-body-sm transition-all text-left ${
                  activeModule === 'developer'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg">terminal</span>
                <span>Developer</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Sidebar Support & Settings */}
        <div className="p-space-md flex flex-col gap-1">
          <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider px-space-xs block mb-space-2xs">
            Support
          </span>
          <button
            type="button"
            onClick={() => setActiveModule('developer')}
            className="w-full flex items-center gap-space-xs px-space-xs py-space-xs rounded-xl font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all text-left"
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('knowledge-base')}
            className="w-full flex items-center gap-space-xs px-space-xs py-space-xs rounded-xl font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all text-left"
          >
            <span className="material-symbols-outlined text-lg">help</span>
            <span>Help &amp; Support</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area (Offset 64 = 256px) */}
      <div className="pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-space-lg">
          {/* Universal Search Bar */}
          <div className="flex items-center flex-1 max-w-md">
            <div className="w-full flex items-center bg-surface-container-low px-space-sm py-space-2xs rounded-xl text-on-surface-variant shadow-inner">
              <span className="material-symbols-outlined text-lg mr-space-xs text-outline">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, messages, KB..."
                className="bg-transparent font-body-sm text-body-sm text-on-surface placeholder:text-outline flex-1 focus:outline-none"
              />
              <span className="font-caption text-caption bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 rounded-lg font-semibold select-none">
                ⌘K
              </span>
            </div>
          </div>

          {/* Right Header Utilities: Notifications & Profile */}
          <div className="flex items-center gap-space-md relative">
            <button
              aria-label="Notifications"
              type="button"
              className="relative p-space-xs rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all"
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              {notificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest"></span>
              )}
            </button>

            {/* Profile Menu Trigger */}
            <div className="relative">
              <div
                className="flex items-center gap-space-xs cursor-pointer rounded-xl p-space-2xs hover:bg-surface-container-low transition-colors"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              >
                <img
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                  src={USER_AVATAR_URL}
                />
                <div className="flex flex-col text-left">
                  <span className="font-title-sm text-title-sm text-on-surface leading-tight">Sarah Jenkins</span>
                  <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Admin</span>
                </div>
                <span className="material-symbols-outlined text-base text-outline ml-1">expand_more</span>
              </div>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-xl z-50 py-2 border border-surface-container-high">
                  <div className="px-4 py-2 border-b border-surface-container-low">
                    <p className="font-title-sm text-title-sm text-on-surface">Sarah Jenkins</p>
                    <p className="font-caption text-caption text-outline">sarah@omniflow.io</p>
                  </div>
                  <button
                    onClick={() => { setActiveModule('teams'); setProfileDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base text-outline">account_circle</span>
                    <span>Manage Account</span>
                  </button>
                  <button
                    onClick={() => { setActiveModule('developer'); setProfileDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base text-outline">key</span>
                    <span>API Credentials</span>
                  </button>
                  <div className="h-px bg-surface-container-low my-1" />
                  <button
                    onClick={() => { setProfileDropdownOpen(false); onLogout?.(); }}
                    className="w-full text-left px-4 py-2 font-body-sm text-body-sm text-error hover:bg-error-container/30 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base text-error">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Container */}
        <main className="w-full pt-16 px-space-lg pb-space-xl bg-background flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
