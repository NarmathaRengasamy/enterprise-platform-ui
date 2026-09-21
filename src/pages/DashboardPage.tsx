import React from 'react';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_CONVERSATIONS,
  INITIAL_SCHEDULE_EVENTS,
  INITIAL_TEAM
} from '../data/mockData';
import { Button, MetricsCard, Icon, StatusBadge } from '../components/common';

interface DashboardPageProps {
  setActiveModule?: (module: string) => void;
  setSelectedProduct?: (product: any) => void;
  setSelectedScheduleEvent?: (event: any) => void;
  setSelectedConversationId?: (id: string) => void;
}

export default function DashboardPage({
  setActiveModule,
  setSelectedProduct,
  setSelectedScheduleEvent,
  setSelectedConversationId
}: DashboardPageProps) {
  const recentProducts = INITIAL_PRODUCTS.slice(0, 4);
  const recentAppointments = INITIAL_SCHEDULE_EVENTS.slice(0, 3);
  const recentConversations = INITIAL_CONVERSATIONS.slice(0, 3);

  const totalProducts = INITIAL_PRODUCTS.length;
  const inStockProducts = INITIAL_PRODUCTS.filter((p) => p.stockStatus === 'In Stock').length;

  const totalCategories = INITIAL_CATEGORIES.length;

  const totalAppointments = INITIAL_SCHEDULE_EVENTS.length;
  const confirmedAppointments = INITIAL_SCHEDULE_EVENTS.filter((e) => e.status === 'Confirmed').length;

  const totalTeamMembers = INITIAL_TEAM.length;
  const activeTeamMembers = INITIAL_TEAM.filter((m) => m.status === 'Active').length;

  return (
    <div className="flex flex-col gap-space-lg w-full pt-space-xs pb-10">
      {/* Streamlined Clean Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Live Feed
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Welcome back! Here's an overview of your operations today.
          </p>
        </div>

        {/* Action Bar & Solid Today Date Badge */}
        <div className="flex items-center flex-wrap gap-2.5 self-start md:self-auto">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-surface-container shadow-xs">
            <Icon name="calendar_today" size="sm" color="primary" />
            <span className="font-label-md text-label-md text-on-surface font-semibold">Today: 12 Sep 2026</span>
          </div>

          <Button
            variant="primary"
            size="md"
            startIcon="add"
            onClick={() => {
              if (setActiveModule) setActiveModule('add-product');
            }}
          >
            Add Product
          </Button>
        </div>
      </div>

      {/* 4 Standard Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <MetricsCard
          title="Total Products"
          value={totalProducts}
          trend={`${inStockProducts} In Stock`}
          trendType="positive"
          icon="inventory_2"
          variant="primary"
          onClick={() => setActiveModule && setActiveModule('products')}
        />

        <MetricsCard
          title="Total Categories"
          value={totalCategories}
          trend="All operational"
          trendType="positive"
          icon="category"
          variant="secondary"
          onClick={() => setActiveModule && setActiveModule('categories')}
        />

        <MetricsCard
          title="Total Appointments"
          value={totalAppointments}
          trend={`${confirmedAppointments} confirmed`}
          trendType="warning"
          icon="event"
          variant="tertiary"
          onClick={() => setActiveModule && setActiveModule('schedule')}
        />

        <MetricsCard
          title="Team Members"
          value={totalTeamMembers}
          trend={`${activeTeamMembers} Active`}
          trendType="positive"
          icon="groups"
          variant="neutral"
          onClick={() => setActiveModule && setActiveModule('teams')}
        />
      </div>

      {/* Balanced 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg items-start">
        {/* LEFT COLUMN: Recent Products & Category Insights */}
        <div className="flex flex-col gap-space-lg">
          {/* Card 1: Recent Products */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden flex flex-col">
            <div className="px-space-md py-space-sm bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-space-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold tracking-tight">
                  Recent Products
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                endIcon="arrow_forward"
                onClick={() => setActiveModule && setActiveModule('products')}
              >
                View all products
              </Button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/40 text-on-surface-variant border-b border-surface-container-low">
                    <th className="py-2.5 px-space-md font-caption text-caption uppercase tracking-wider font-semibold" scope="col">
                      Product
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
                <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                  {recentProducts.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => {
                        if (setSelectedProduct) setSelectedProduct(p);
                        if (setActiveModule) setActiveModule('product-details');
                      }}
                      className="hover:bg-surface-container-low/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-space-md">
                        <div className="flex items-center gap-space-xs">
                          <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0 overflow-hidden shadow-xs">
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          </div>
                          <span
                            title={p.name}
                            className="font-title-sm text-title-sm text-on-surface group-hover:text-primary transition-colors truncate max-w-[180px]"
                          >
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-space-md text-on-surface-variant">
                        {p.category}
                      </td>
                      <td className="py-3 px-space-md font-title-sm text-title-sm font-semibold">
                        ₹{p.price.toLocaleString()}
                      </td>
                      <td className="py-3 px-space-md text-right">
                        <StatusBadge status={p.stockStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: Inventory by Category Overview */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden flex flex-col">
            <div className="px-space-md py-space-sm bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-space-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold tracking-tight">
                  Categories &amp; Catalog
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                endIcon="arrow_forward"
                onClick={() => setActiveModule && setActiveModule('categories')}
              >
                Manage categories
              </Button>
            </div>

            <div className="p-space-md grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INITIAL_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => setActiveModule && setActiveModule('categories')}
                  className="p-3.5 rounded-xl border border-surface-container bg-surface-container-low/30 hover:bg-surface-container-low/80 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors shrink-0">
                      <Icon name={cat.icon || 'category'} size="lg" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-title-sm text-title-sm text-on-surface font-bold truncate group-hover:text-primary transition-colors">
                        {cat.name}
                      </span>
                      <span className="font-caption text-caption text-on-surface-variant truncate">
                        {cat.description}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-surface-container-lowest border border-surface-container text-primary shrink-0 ml-2">
                    {cat.productsCount} items
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Upcoming Appointments & Active Conversations */}
        <div className="flex flex-col gap-space-lg">
          {/* Card 1: Upcoming Appointments */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden flex flex-col">
            <div className="px-space-md py-space-sm bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-space-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-tertiary"></div>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold tracking-tight">
                  Upcoming Appointments
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                endIcon="arrow_forward"
                onClick={() => setActiveModule && setActiveModule('schedule')}
              >
                View schedule
              </Button>
            </div>

            <div className="divide-y divide-surface-container-low">
              {recentAppointments.map((app) => (
                <div
                  key={app.id}
                  onClick={() => {
                    if (setSelectedScheduleEvent) setSelectedScheduleEvent(app);
                    if (setActiveModule) setActiveModule('schedule');
                  }}
                  className="p-space-md hover:bg-surface-container-low/60 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-tertiary-fixed/30 flex items-center justify-center text-tertiary flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Icon name="calendar_month" size="lg" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-title-sm text-title-sm text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
                        {app.title}
                      </span>
                      <span className="font-caption text-caption text-outline truncate">
                        {app.time} • {app.client}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-fixed/40 text-on-secondary-fixed-variant font-semibold shrink-0 ml-2">
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Active Conversations Preview */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden flex flex-col">
            <div className="px-space-md py-space-sm bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-space-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-600"></div>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold tracking-tight">
                  Active Conversations
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                endIcon="arrow_forward"
                onClick={() => setActiveModule && setActiveModule('conversations')}
              >
                Open inbox
              </Button>
            </div>

            <div className="divide-y divide-surface-container-low">
              {recentConversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    if (setSelectedConversationId) setSelectedConversationId(c.id);
                    if (setActiveModule) setActiveModule('conversations');
                  }}
                  className="p-space-md hover:bg-surface-container-low/60 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {c.avatar ? (
                      <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {c.initials || 'DM'}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-title-sm text-title-sm text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
                        {c.name}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate max-w-[240px]">
                        {c.lastMessage}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full font-label-sm text-caption bg-surface-container-high text-primary font-semibold shrink-0 ml-2">
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
