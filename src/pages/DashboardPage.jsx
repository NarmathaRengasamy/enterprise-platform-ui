import React from 'react';
import { INITIAL_PRODUCTS, INITIAL_CONVERSATIONS, INITIAL_SCHEDULE_EVENTS } from '../data/mockData';

export default function DashboardPage({ setActiveModule, setSelectedProduct }) {
  const recentProducts = INITIAL_PRODUCTS.slice(0, 4);
  const recentAppointments = INITIAL_SCHEDULE_EVENTS.slice(0, 3);
  const recentConversations = INITIAL_CONVERSATIONS.slice(0, 3);

  return (
    <div className="flex flex-col w-full">
      {/* Top Header & Overview Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-space-xl gap-space-sm pt-space-xs">
        <div>
          <div className="flex items-center gap-space-xs mb-1">
            <span className="font-caption text-caption uppercase tracking-wider text-primary font-bold">
              Workspace Overview
            </span>
            <span className="w-1 h-1 rounded-full bg-primary/40"></span>
            <span className="font-caption text-caption text-on-surface-variant font-medium">Live Feed</span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">
            Dashboard
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Welcome back! Here's an overview of your operations today.
          </p>
        </div>
        <div className="flex items-center gap-space-xs">
          <div className="hidden sm:flex items-center bg-surface-container-lowest px-space-sm py-2 rounded-xl shadow-sm">
            <span className="material-symbols-outlined text-outline text-base mr-2">calendar_today</span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">Today: 12 Sep 2026</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('add-product')}
            className="flex items-center gap-space-2xs bg-primary-container text-on-primary-container font-title-sm text-title-sm px-space-md py-2 rounded-xl shadow-sm hover:bg-primary hover:text-on-primary transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Quick Action</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg mb-space-xl">
        {/* Metric 1: Products */}
        <div
          onClick={() => setActiveModule('products')}
          className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group cursor-pointer"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-primary/5 pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">Total Products</span>
              <div className="w-9 h-9 rounded-xl bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant">
                <span className="material-symbols-outlined text-xl">inventory_2</span>
              </div>
            </div>
            <div className="font-headline-lg text-display-lg font-bold text-on-surface tracking-tight mb-space-xs">
              120
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-space-xs">
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-fixed/40 text-on-secondary-fixed-variant font-semibold">
              <span className="material-symbols-outlined text-xs">trending_up</span>
              +12%
            </span>
            <span className="font-caption text-caption text-on-surface-variant font-medium">this month</span>
          </div>
        </div>

        {/* Metric 2: Categories */}
        <div
          onClick={() => setActiveModule('categories')}
          className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group cursor-pointer"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-secondary-fixed/20 pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">Total Categories</span>
              <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">category</span>
              </div>
            </div>
            <div className="font-headline-lg text-display-lg font-bold text-on-surface tracking-tight mb-space-xs">
              12
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-space-xs">
            <span className="font-caption text-caption text-on-surface-variant font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              All operational
            </span>
          </div>
        </div>

        {/* Metric 3: Appointments */}
        <div
          onClick={() => setActiveModule('calendar')}
          className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group cursor-pointer"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-tertiary-fixed/30 pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">Total Appointments</span>
              <div className="w-9 h-9 rounded-xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed-variant">
                <span className="material-symbols-outlined text-xl">event</span>
              </div>
            </div>
            <div className="font-headline-lg text-display-lg font-bold text-on-surface tracking-tight mb-space-xs">
              28
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-space-xs">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-tertiary-fixed text-on-tertiary-fixed-variant font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              4 pending
            </span>
            <span className="font-caption text-caption text-on-surface-variant font-medium">requires review</span>
          </div>
        </div>

        {/* Metric 4: Team Members */}
        <div
          onClick={() => setActiveModule('teams')}
          className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group cursor-pointer"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-surface-variant/40 pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">Team Members</span>
              <div className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-xl">groups</span>
              </div>
            </div>
            <div className="font-headline-lg text-display-lg font-bold text-on-surface tracking-tight mb-space-xs">
              5
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-space-xs">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-fixed/40 text-on-secondary-fixed-variant font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              Active
            </span>
            <span className="font-caption text-caption text-on-surface-variant font-medium">100% attendance</span>
          </div>
        </div>
      </div>

      {/* Dual Column Layout: Recent Products & Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg items-start">
        {/* Left Card: Recent Products */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-space-md py-space-sm bg-surface-container-lowest flex items-center justify-between border-b border-surface-container-low">
            <div className="flex items-center gap-space-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
                Recent Products
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('products')}
              className="font-label-sm text-label-sm text-primary hover:text-on-primary-fixed-variant font-semibold inline-flex items-center gap-1 transition-colors"
            >
              View all
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant">
                  <th className="py-2.5 px-space-md font-caption text-caption uppercase tracking-wider font-semibold" scope="col">
                    Name
                  </th>
                  <th className="py-2.5 px-space-md font-caption text-caption uppercase tracking-wider font-semibold" scope="col">
                    Category
                  </th>
                  <th className="py-2.5 px-space-md font-caption text-caption uppercase tracking-wider font-semibold" scope="col">
                    Price
                  </th>
                  <th className="py-2.5 px-space-md font-caption text-caption uppercase tracking-wider font-semibold text-right" scope="col">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {recentProducts.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => {
                      if (setSelectedProduct) setSelectedProduct(p);
                      setActiveModule('product-details');
                    }}
                    className="hover:bg-surface-container-low/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-space-md">
                      <div className="flex items-center gap-space-xs">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0 overflow-hidden">
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <span className="font-title-sm text-title-sm text-on-surface group-hover:text-primary transition-colors truncate max-w-[160px]">
                          {p.shortName || p.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-space-md font-body-sm text-body-sm text-on-surface-variant">
                      {p.category}
                    </td>
                    <td className="py-3.5 px-space-md font-title-sm text-title-sm text-on-surface">
                      ₹{p.price.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-space-md text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                          p.stockStatus === 'In Stock'
                            ? 'bg-secondary-fixed/50 text-on-secondary-fixed-variant'
                            : 'bg-tertiary-fixed/60 text-on-tertiary-fixed'
                        }`}
                      >
                        {p.stockStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Card: Recent Appointments & Conversations */}
        <div className="flex flex-col gap-space-lg">
          {/* Recent Appointments */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-space-md py-space-sm bg-surface-container-lowest flex items-center justify-between border-b border-surface-container-low">
              <div className="flex items-center gap-space-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-tertiary"></div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
                  Upcoming Appointments
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('schedule')}
                className="font-label-sm text-label-sm text-primary hover:text-on-primary-fixed-variant font-semibold inline-flex items-center gap-1 transition-colors"
              >
                View schedule
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <div className="divide-y divide-surface-container-low">
              {recentAppointments.map((app) => (
                <div
                  key={app.id}
                  onClick={() => setActiveModule('schedule')}
                  className="p-space-md hover:bg-surface-container-low/60 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-tertiary-fixed/30 flex items-center justify-center text-tertiary flex-shrink-0">
                      <span className="material-symbols-outlined text-lg">calendar_month</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                        {app.title}
                      </span>
                      <span className="font-caption text-caption text-outline">
                        {app.time} • {app.client}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-fixed/40 text-on-secondary-fixed-variant font-semibold">
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Conversations Preview */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-space-md py-space-sm bg-surface-container-lowest flex items-center justify-between border-b border-surface-container-low">
              <div className="flex items-center gap-space-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
                  Active Conversations
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('conversations')}
                className="font-label-sm text-label-sm text-primary hover:text-on-primary-fixed-variant font-semibold inline-flex items-center gap-1 transition-colors"
              >
                Open inbox
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <div className="divide-y divide-surface-container-low">
              {recentConversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setActiveModule('conversations')}
                  className="p-space-md hover:bg-surface-container-low/60 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {c.avatar ? (
                      <img src={c.avatar} alt={c.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {c.initials || 'DM'}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-title-sm text-title-sm text-on-surface font-semibold truncate">
                        {c.name}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate max-w-[220px]">
                        {c.lastMessage}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full font-label-sm text-caption bg-surface-container-high text-primary font-semibold">
                    {c.channelLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
