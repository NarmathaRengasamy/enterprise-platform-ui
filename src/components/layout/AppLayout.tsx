import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLabels, useSiteSettings } from '../../context/SiteSettingsContext';
import { useSystemHealth } from '../../hooks/useSystemHealth';
import CallPanel from '../call/CallPanel';

interface AppLayoutProps {
  activeModule?: string;
  setActiveModule?: (module: string) => void;
  children?: React.ReactNode;
  onLogout?: () => void;
}

export default function AppLayout({ activeModule: activeModuleProp, setActiveModule, children, onLogout }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const { settings: siteSettings } = useSiteSettings();
  const label = useLabels();
  const health = useSystemHealth();
  /* The registered name if there is one, otherwise what the workspace is
     called — never a company name typed into the layout. */
  const platformName = siteSettings.legalName?.trim() || siteSettings.siteName;
  const location = useLocation();
  const navigate = useNavigate();

  const displayName = user?.name || 'Sarah Jenkins';
  const displayEmail = user?.email || 'sarah@omniflow.io';
  const displayRole = user?.role || 'Admin';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SJ';

  const getActiveModuleFromPath = (path: string): string => {
    if (path.startsWith('/conversations')) return 'conversations';
    if (path.startsWith('/categories')) return 'categories';
    if (path.startsWith('/attributes')) return 'attributes';
    if (path.startsWith('/products/new') || path.startsWith('/products/add')) return 'add-product';
    if (path.startsWith('/products/edit') || path.includes('/edit')) return 'edit-product';
    if (path.startsWith('/products/details') || (path.startsWith('/products/') && path !== '/products')) return 'product-details';
    if (path.startsWith('/products')) return 'products';
    if (path.startsWith('/schedule') || path.startsWith('/calendar') || path.startsWith('/appointments')) return 'schedule';
    if (path.startsWith('/teams')) return 'teams';
    if (path.startsWith('/knowledge-base') || path.startsWith('/collections')) return 'knowledge-base';
    if (path.startsWith('/developer')) return 'developer';
    /* No sidebar entry — it is reached from the profile menu — but it still
       needs its own module, or /settings would light up Dashboard. */
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const activeModule = activeModuleProp || getActiveModuleFromPath(location.pathname);

  const [productsSubmenuOpen, setProductsSubmenuOpen] = useState(
    activeModule === 'products' ||
    activeModule === 'categories' ||
    activeModule === 'attributes' ||
    activeModule === 'add-product' ||
    activeModule === 'product-details' ||
    activeModule === 'edit-product'
  );
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Automatically open products submenu for product/category modules
  useEffect(() => {
    const isProductRelated =
      activeModule === 'products' ||
      activeModule === 'categories' ||
      activeModule === 'add-product' ||
      activeModule === 'product-details' ||
      activeModule === 'edit-product';

    if (isProductRelated) {
      setProductsSubmenuOpen(true);
    }
  }, [activeModule]);

  // Notification state
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-1',
      title: 'Upcoming Consultation',
      description: 'AI Agent Consultation with Marcus Vance starting at 10:00 AM',
      time: '10m ago',
      type: 'schedule',
      unread: true,
      icon: 'calendar_month',
      iconBg: 'bg-blue-500/15 text-blue-600'
    },
    {
      id: 'notif-2',
      title: 'New WhatsApp Inquiry',
      description: 'Elena Rostova: "Can you confirm our reorder #4891?"',
      time: '32m ago',
      type: 'conversations',
      unread: true,
      icon: 'chat',
      iconBg: 'bg-emerald-500/15 text-emerald-600'
    },
    {
      id: 'notif-3',
      title: 'Low Inventory Alert',
      description: 'Urban Tech Minimalist Backpack reached reorder point (18 left)',
      time: '2h ago',
      type: 'products',
      unread: true,
      icon: 'inventory_2',
      iconBg: 'bg-amber-500/15 text-amber-600'
    },
    {
      id: 'notif-4',
      title: 'Agent Task Completed',
      description: 'Support Bot auto-resolved 14 customer queries today',
      time: '4h ago',
      type: 'developer',
      unread: false,
      icon: 'smart_toy',
      iconBg: 'bg-purple-500/15 text-purple-600'
    }
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleNav = (module: string, path: string) => {
    setActiveModule?.(module);
    navigate(path);
  };

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, unread: false } : n))
    );
    setNotificationsOpen(false);
    if (notif.type) {
      handleNav(notif.type, `/${notif.type}`);
    }
  };

  const isProductsActive =
    activeModule === 'products' ||
    activeModule === 'categories' ||
    activeModule === 'attributes' ||
    activeModule === 'add-product' ||
    activeModule === 'product-details' ||
    activeModule === 'edit-product';

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('omni_sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('omni_sidebar_open', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Persistent Collapsible Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between select-none border-r border-surface-container/60 transition-all duration-300 ease-in-out ${
          isSidebarOpen
            ? 'w-64 translate-x-0'
            : 'w-[72px] -translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col min-w-0">
          {/* Streamlined Brand Header */}
          <div
            className={`h-16 flex items-center border-b border-surface-container/60 transition-colors ${
              isSidebarOpen ? 'px-4' : 'px-2 justify-center'
            }`}
          >
            <div
              className="flex items-center gap-3 cursor-pointer min-w-0 overflow-hidden w-full"
              onClick={() => handleNav('dashboard', '/dashboard')}
              title={`${siteSettings.siteName} Dashboard`}
            >
              {/* The uploaded logo replaces the built-in mark rather than
                  sitting beside it — two logos is worse than either. */}
              {siteSettings.logoUrl ? (
                <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-white border border-slate-200 flex items-center justify-center">
                  <img
                    src={siteSettings.logoUrl}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-blue-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <span className="material-symbols-outlined text-xl">all_inclusive</span>
                </div>
              )}
              {isSidebarOpen && (
                /* `flex-1 min-w-0` is what makes `truncate` work here: without
                   min-w-0 a flex child refuses to shrink below its content, so
                   a long name pushes the block wider than the sidebar instead
                   of being cut. The title attributes keep the full text
                   reachable once it is shortened. */
                <div className="flex flex-col flex-1 min-w-0 animate-fadeIn">
                  <span
                    className="font-headline-sm text-base text-on-surface tracking-tight font-bold leading-tight truncate"
                    title={siteSettings.siteName}
                  >
                    {siteSettings.siteName}
                  </span>
                  {siteSettings.tagline && (
                    <span
                      className="text-[10px] text-primary font-semibold tracking-wider uppercase truncate"
                      title={siteSettings.tagline}
                    >
                      {siteSettings.tagline}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation Menu */}
          <div className={`pt-3 ${isSidebarOpen ? 'px-3' : 'px-2'}`}>
            <nav className="flex flex-col gap-1">
              {/* 1. Dashboard */}
              <button
                type="button"
                onClick={() => handleNav('dashboard', '/dashboard')}
                title={!isSidebarOpen ? label.plural('dashboard') : undefined}
                className={`w-full flex items-center rounded-xl font-body-sm text-body-sm transition-all text-left cursor-pointer ${
                  isSidebarOpen ? 'gap-2.5 px-3 py-2' : 'justify-center p-2.5'
                } ${
                  activeModule === 'dashboard'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">dashboard</span>
                {isSidebarOpen && <span className="truncate animate-fadeIn">{label.plural('dashboard')}</span>}
              </button>

              {/* 2. Conversations */}
              <button
                type="button"
                onClick={() => handleNav('conversations', '/conversations')}
                title={!isSidebarOpen ? label.plural('conversations') : undefined}
                className={`w-full flex items-center rounded-xl font-body-sm text-body-sm transition-all text-left cursor-pointer relative ${
                  isSidebarOpen ? 'justify-between px-3 py-2' : 'justify-center p-2.5'
                } ${
                  activeModule === 'conversations'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <div className={`flex items-center ${isSidebarOpen ? 'gap-2.5 truncate' : ''}`}>
                  <span className="material-symbols-outlined text-lg shrink-0">chat</span>
                  {isSidebarOpen && <span className="truncate animate-fadeIn">{label.plural('conversations')}</span>}
                </div>
              </button>

              {/* 3. Products Submenu */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!isSidebarOpen) {
                      handleNav('products', '/products');
                    } else {
                      setProductsSubmenuOpen(!productsSubmenuOpen);
                    }
                  }}
                  title={!isSidebarOpen ? label.plural('products') : undefined}
                  className={`w-full flex items-center rounded-xl font-body-sm text-body-sm transition-all text-left cursor-pointer ${
                    isSidebarOpen ? 'justify-between px-3 py-2' : 'justify-center p-2.5'
                  } ${
                    isProductsActive
                      ? 'text-on-surface font-semibold bg-surface-container-low'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <div className={`flex items-center ${isSidebarOpen ? 'gap-2.5 truncate' : ''}`}>
                    <span className={`material-symbols-outlined text-lg shrink-0 ${isProductsActive ? 'text-primary' : ''}`}>
                      inventory_2
                    </span>
                    {isSidebarOpen && <span className="truncate animate-fadeIn">{label.plural('products')}</span>}
                  </div>
                  {isSidebarOpen && (
                    <span
                      className={`material-symbols-outlined text-base text-outline transition-transform duration-200 ${
                        productsSubmenuOpen ? 'rotate-180' : ''
                      }`}
                    >
                      expand_more
                    </span>
                  )}
                </button>

                {isSidebarOpen && productsSubmenuOpen && (
                  <div className="flex flex-col gap-1 pl-6 ml-2 animate-fadeIn">
                    {/* 3.1 All Products */}
                    <button
                      type="button"
                      onClick={() => handleNav('products', '/products')}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg font-body-sm text-body-sm transition-all text-left cursor-pointer ${
                        activeModule === 'products' || activeModule === 'add-product' || activeModule === 'product-details' || activeModule === 'edit-product'
                          ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          activeModule === 'products' || activeModule === 'add-product' || activeModule === 'product-details' || activeModule === 'edit-product'
                            ? 'bg-primary-fixed-dim'
                            : 'bg-outline/40'
                        }`}
                      />
                      <span>{label.plural('allProducts')}</span>
                    </button>

                    {/* 3.2 Categories */}
                    <button
                      type="button"
                      onClick={() => handleNav('categories', '/categories')}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg font-body-sm text-body-sm transition-all text-left cursor-pointer ${
                        activeModule === 'categories'
                          ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          activeModule === 'categories' ? 'bg-primary-fixed-dim' : 'bg-outline/40'
                        }`}
                      />
                      <span>{label.plural('categories')}</span>
                    </button>

                    {/* 3.3 Attributes — the product fields pre-loaded from the
                        business category, plus the admin's own. */}
                    <button
                      type="button"
                      onClick={() => handleNav('attributes', '/attributes')}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg font-body-sm text-body-sm transition-all text-left cursor-pointer ${
                        activeModule === 'attributes'
                          ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          activeModule === 'attributes' ? 'bg-primary-fixed-dim' : 'bg-outline/40'
                        }`}
                      />
                      <span>Attributes</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Schedule */}
              <button
                type="button"
                onClick={() => handleNav('schedule', '/schedule')}
                title={!isSidebarOpen ? label.plural('schedule') : undefined}
                className={`w-full flex items-center rounded-xl font-body-sm text-body-sm transition-all text-left cursor-pointer ${
                  isSidebarOpen ? 'gap-2.5 px-3 py-2' : 'justify-center p-2.5'
                } ${
                  activeModule === 'schedule' || activeModule === 'calendar' || activeModule === 'appointments'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">calendar_month</span>
                {isSidebarOpen && <span className="truncate animate-fadeIn">{label.plural('schedule')}</span>}
              </button>

              {/* 5. Teams */}
              <button
                type="button"
                onClick={() => handleNav('teams', '/teams')}
                title={!isSidebarOpen ? label.plural('teams') : undefined}
                className={`w-full flex items-center rounded-xl font-body-sm text-body-sm transition-all text-left cursor-pointer ${
                  isSidebarOpen ? 'gap-2.5 px-3 py-2' : 'justify-center p-2.5'
                } ${
                  activeModule === 'teams'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">groups</span>
                {isSidebarOpen && <span className="truncate animate-fadeIn">{label.plural('teams')}</span>}
              </button>

              {/* 6. Knowledge Base */}
              <button
                type="button"
                onClick={() => handleNav('knowledge-base', '/knowledge-base')}
                title={!isSidebarOpen ? label.plural('knowledgeBase') : undefined}
                className={`w-full flex items-center rounded-xl font-body-sm text-body-sm transition-all text-left cursor-pointer ${
                  isSidebarOpen ? 'gap-2.5 px-3 py-2' : 'justify-center p-2.5'
                } ${
                  activeModule === 'knowledge-base' || activeModule === 'collections'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">menu_book</span>
                {isSidebarOpen && <span className="truncate animate-fadeIn">{label.plural('knowledgeBase')}</span>}
              </button>

              {/* 7. Developer */}
              <button
                type="button"
                onClick={() => handleNav('developer', '/developer')}
                title={!isSidebarOpen ? label.plural('developer') : undefined}
                className={`w-full flex items-center rounded-xl font-body-sm text-body-sm transition-all text-left cursor-pointer ${
                  isSidebarOpen ? 'gap-2.5 px-3 py-2' : 'justify-center p-2.5'
                } ${
                  activeModule === 'developer'
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">terminal</span>
                {isSidebarOpen && <span className="truncate animate-fadeIn">{label.plural('developer')}</span>}
              </button>
            </nav>
          </div>
        </div>

        {/* Professional Sidebar Enterprise Footer */}
        <div className={`border-t border-surface-container/60 bg-surface-container-low/20 transition-all ${
          isSidebarOpen ? 'p-3.5' : 'p-2 flex flex-col items-center justify-center'
        }`}>
          {isSidebarOpen ? (
            <>
              {/* Reported, not asserted. This used to read "Systems Active"
                  and "v2.4.0" as plain text — it said the system was healthy
                  while the server was down, and showed a version nobody had
                  updated since it was typed. Both come from /api/health now,
                  and the names come from the workspace settings. */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0" title={health.detail}>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      health.checking
                        ? 'bg-slate-300'
                        : health.online
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-error'
                    }`}
                  />
                  <span className="text-[11px] font-semibold text-on-surface truncate">
                    {health.checking
                      ? 'Checking\u2026'
                      : health.online
                        ? 'Systems Active'
                        : 'Service Unavailable'}
                  </span>
                </div>
                {health.version && (
                  <span className="text-[10px] font-mono text-outline font-medium bg-surface-container px-1.5 py-0.2 rounded shrink-0">
                    v{health.version}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 text-[10px] text-on-surface-variant">
                <span className="text-outline font-medium truncate" title={platformName}>
                  {platformName}
                </span>
                <span className="text-outline/80 truncate">
                  &copy; {new Date().getFullYear()} {siteSettings.siteName}. All rights reserved.
                </span>
              </div>
            </>
          ) : (
            <div
              className="flex flex-col items-center gap-1"
              title={`${health.online ? 'Systems Active' : health.detail}${
                health.version ? ` (v${health.version})` : ''
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  health.checking
                    ? 'bg-slate-300'
                    : health.online
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-error'
                }`}
              />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area (Dynamic Offset) */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'md:pl-64' : 'md:pl-[72px]'
        }`}
      >
        {/* Top Header */}
        <header
          className={`fixed top-0 right-0 h-16 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-40 flex items-center justify-between px-space-lg border-b border-surface-container transition-all duration-300 ease-in-out ${
            isSidebarOpen ? 'left-0 md:left-64' : 'left-0 md:left-[72px]'
          }`}
        >
          {/* Left Header: Sidebar Toggle */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleSidebar}
              className="w-9 h-9 rounded-xl border border-surface-container bg-surface-container-low/80 hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0"
              title={isSidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
            >
              <span className="material-symbols-outlined text-xl">
                {isSidebarOpen ? 'menu_open' : 'menu'}
              </span>
            </button>
          </div>

          {/* Right Header Utilities: Notifications & Profile */}
          <div className="flex items-center gap-3 relative">
            {/* Notification Bell with Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                aria-label="Notifications"
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer border ${
                  notificationsOpen
                    ? 'bg-primary-container/10 text-primary border-primary/30 ring-2 ring-primary/15 shadow-xs'
                    : 'bg-surface-container-low/80 border-surface-container text-on-surface-variant hover:bg-surface-container hover:text-primary hover:border-primary/20 shadow-2xs'
                }`}
                title="View notifications"
              >
                <span className="material-symbols-outlined text-lg">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-white animate-pulse"></span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl z-50 border border-slate-200/90 ring-1 ring-black/5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="font-title-sm text-title-sm font-bold text-on-surface">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-md bg-primary text-on-primary text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                          n.unread ? 'bg-primary/[0.04]' : 'bg-white'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${n.iconBg}`}>
                          <span className="material-symbols-outlined text-base">{n.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-title-sm text-xs font-bold text-on-surface truncate">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-outline shrink-0">{n.time}</span>
                          </div>
                          <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5 leading-snug">
                            {n.description}
                          </p>
                        </div>
                        {n.unread && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5"></span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 border-t border-slate-100 bg-slate-50 text-center">
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                      Close Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu Trigger & Dropdown */}
            <div className="relative" ref={profileRef}>
              <div
                className={`flex items-center gap-2.5 cursor-pointer rounded-xl pl-1.5 pr-2.5 py-1 border transition-all shadow-2xs ${
                  profileDropdownOpen
                    ? 'bg-surface-container border-primary/30 ring-2 ring-primary/15'
                    : 'bg-surface-container-low/80 border-surface-container hover:bg-surface-container hover:border-primary/20'
                }`}
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs ring-1 ring-primary/30">
                  {initials}
                </div>
                <div className="flex flex-col text-left sm:flex">
                  <span className="font-title-sm text-xs text-on-surface font-bold leading-tight">{displayName}</span>
                  <span className={`font-caption text-[9.5px] uppercase tracking-wider font-semibold ${
                    displayRole === 'Admin' ? 'text-primary' : displayRole === 'Editor' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {displayRole}
                  </span>
                </div>
                <span className={`material-symbols-outlined text-base text-outline transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180 text-primary' : ''}`}>
                  expand_more
                </span>
              </div>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl z-50 py-2 border border-slate-200/90 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
                    <p className="font-title-sm text-sm text-on-surface font-bold">{displayName}</p>
                    <p className="font-caption text-xs text-outline">{displayEmail}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleNav('teams', '/teams');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 font-body-sm text-xs text-on-surface hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-outline">groups</span>
                      <span>Manage {label.plural('teams')}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleNav('developer', '/developer');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 font-body-sm text-xs text-on-surface hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-outline">terminal</span>
                      <span>{label.plural('developer')} API</span>
                    </button>
                    <button
                      onClick={() => {
                        handleNav('settings', '/settings');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 font-body-sm text-xs text-on-surface hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-outline">settings</span>
                      <span>Settings</span>
                    </button>
                  </div>
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout();
                      if (onLogout) {
                        onLogout();
                      } else {
                        navigate('/login');
                      }
                    }}
                    className="w-full text-left px-4 py-2 font-body-sm text-xs text-error hover:bg-red-50 flex items-center gap-2.5 cursor-pointer font-semibold transition-colors"
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
        <main className="w-full pt-[5.25rem] px-space-lg pb-space-lg bg-background flex-1 flex flex-col">
          {children || <Outlet />}
        </main>

        {/* Docked above every page: a call keeps running while the operator
            moves around the app, and an incoming one has to ring here too. */}
        <CallPanel />
      </div>
    </div>
  );
}
