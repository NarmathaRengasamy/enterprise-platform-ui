import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  INITIAL_SCHEDULE_EVENTS
} from '../data/mockData';
import { Button, MetricsCard, Icon, StatusBadge } from '../components/common';
import { productV2Service } from '../services/productV2.service';
import { catalogCategoryService } from '../services/catalogCategory.service';
import { conversationService } from '../services/conversation.service';
import { teamService } from '../services/team.service';
import type { ProductSummary, ProductStats } from '../types/productV2.types';
import type { CategoryNode, CategoryStats } from '../types/catalogCategory.types';
import type { ConversationItem } from '../types/conversation.types';
import type { TeamStats } from '../types/team.types';
import { useLabels } from '../context/SiteSettingsContext';
import { formatMoney } from '../utils/money';
import { resolveAssetUrl } from '../utils/assetUrl';
import { CategoryIcon } from '../components/common/CategoryIcon';

interface DashboardPageProps {
  setActiveModule?: (module: string) => void;
  setSelectedProduct?: (product: any) => void;
  setSelectedScheduleEvent?: (event: any) => void;
  setSelectedConversationId?: (id: string) => void;
}

export default function DashboardPage({
  setActiveModule,
  setSelectedScheduleEvent,
  setSelectedConversationId
}: DashboardPageProps) {
  const navigate = useNavigate();
  const label = useLabels();

  // V2 Products State
  const [recentProducts, setRecentProducts] = useState<ProductSummary[]>([]);
  const [productStats, setProductStats] = useState<ProductStats | null>(null);

  // V2 Categories State
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats | null>(null);
  const [categoryMap, setCategoryMap] = useState<Map<string, CategoryNode>>(new Map());

  // Live Conversations State
  const [recentConversations, setRecentConversations] = useState<ConversationItem[]>([]);
  const [totalConversations, setTotalConversations] = useState<number>(0);

  // Team State
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 1. Fetch V2 Products & Stats
    productV2Service
      .search({ page: 1, limit: 4, sort: 'newest' })
      .then((res) => {
        if (!cancelled && res?.items) setRecentProducts(res.items);
      })
      .catch((err) => console.warn('Could not load dashboard products v2:', err));

    productV2Service
      .stats()
      .then((stats) => {
        if (!cancelled && stats) setProductStats(stats);
      })
      .catch((err) => console.warn('Could not load dashboard product stats:', err));

    // 2. Fetch V2 Catalog Categories & Stats
    catalogCategoryService
      .list()
      .then((res) => {
        if (!cancelled && res?.categories) {
          setCategories(res.categories.slice(0, 4));
          const map = new Map<string, CategoryNode>();
          const indexTree = (nodes: CategoryNode[]) => {
            nodes.forEach((n) => {
              map.set(n.id, n);
              if (n.children?.length) indexTree(n.children);
            });
          };
          indexTree(res.categories);
          setCategoryMap(map);
        }
      })
      .catch((err) => console.warn('Could not load dashboard categories v2:', err));

    catalogCategoryService
      .stats()
      .then((stats) => {
        if (!cancelled && stats) setCategoryStats(stats);
      })
      .catch((err) => console.warn('Could not load dashboard category stats:', err));

    // 3. Fetch Live Conversations
    conversationService
      .getConversations()
      .then((res) => {
        if (!cancelled && res?.conversations) {
          setRecentConversations(res.conversations.slice(0, 3));
          setTotalConversations(res.total ?? res.conversations.length);
        }
      })
      .catch((err) => console.warn('Could not load dashboard conversations:', err));

    // 4. Fetch Workspace Team Stats
    teamService
      .getTeamStats()
      .then((stats) => {
        if (!cancelled && stats) setTeamStats(stats);
      })
      .catch((err) => console.warn('Could not load dashboard team stats:', err));

    return () => {
      cancelled = true;
    };
  }, []);

  const recentAppointments = INITIAL_SCHEDULE_EVENTS.slice(0, 3);
  const totalAppointments = INITIAL_SCHEDULE_EVENTS.length;
  const confirmedAppointments = INITIAL_SCHEDULE_EVENTS.filter((e) => e.status === 'Confirmed').length;

  const totalProducts = productStats?.products?.total ?? recentProducts.length;
  const activeProducts = productStats?.products?.active ?? totalProducts;
  const totalVariants = productStats?.variants?.total ?? 0;

  const totalCategories = categoryStats?.total_categories ?? categories.length;
  const assignedSkus = categoryStats?.assigned_skus ?? 0;

  const totalTeamMembers = teamStats?.seatsUsed ?? 3;
  const activeTeamMembers = teamStats?.active ?? totalTeamMembers;

  const handleNav = (module: string, path: string) => {
    if (setActiveModule) setActiveModule(module);
    navigate(path);
  };

  return (
    <div className="flex flex-col gap-space-lg w-full pt-space-xs pb-10">
      {/* Streamlined Clean Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              {label.plural('dashboard')}
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
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              Today: {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}
            </span>
          </div>

          <Button
            variant="primary"
            size="md"
            startIcon="add"
            onClick={() => handleNav('products-v2', '/v2/products/add')}
          >
            Add {label.singular('allProducts')}
          </Button>
        </div>
      </div>

      {/* 4 Standard Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <MetricsCard
          title={`Total ${label.plural('allProducts')}`}
          value={totalProducts}
          trend={totalVariants > 0 ? `${totalVariants} Variants (${activeProducts} Active)` : `${activeProducts} Active`}
          trendType="positive"
          icon="inventory_2"
          variant="primary"
          onClick={() => handleNav('products-v2', '/v2/products')}
        />

        <MetricsCard
          title={`Total ${label.plural('categories')}`}
          value={totalCategories}
          trend={assignedSkus > 0 ? `${assignedSkus} SKUs Assigned` : 'All operational'}
          trendType="positive"
          icon="category"
          variant="secondary"
          onClick={() => handleNav('category-tree', '/category-tree')}
        />

        <MetricsCard
          title={`Total ${label.plural('schedule')}`}
          value={totalAppointments}
          trend={`${confirmedAppointments} confirmed`}
          trendType="warning"
          icon="event"
          variant="tertiary"
          onClick={() => handleNav('schedule', '/schedule')}
        />

        <MetricsCard
          title={label.plural('teams')}
          value={totalTeamMembers}
          trend={`${activeTeamMembers} Active`}
          trendType="positive"
          icon="groups"
          variant="neutral"
          onClick={() => handleNav('teams', '/teams')}
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
                  Recent {label.plural('allProducts')}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                endIcon="arrow_forward"
                onClick={() => handleNav('products-v2', '/v2/products')}
              >
                View all {label.lower('allProducts')}
              </Button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/40 text-on-surface-variant border-b border-surface-container-low">
                    <th className="py-2.5 px-space-md font-caption text-caption uppercase tracking-wider font-semibold" scope="col">
                      {label.singular('allProducts')}
                    </th>
                    <th className="py-2.5 px-space-md font-caption text-caption uppercase tracking-wider font-semibold" scope="col">
                      {label.singular('categories')}
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
                  {recentProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-on-surface-variant">
                        No {label.lower('allProducts')} found.
                      </td>
                    </tr>
                  ) : (
                    recentProducts.map((p) => {
                      const image = resolveAssetUrl(p.media?.[0]?.url);
                      const primaryCat = p.primary_category_id ? categoryMap.get(p.primary_category_id) : (p.category_ids?.length ? categoryMap.get(p.category_ids[0]) : undefined);
                      const catName = primaryCat?.name?.en ?? '—';

                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleNav('products-v2', `/v2/products/${p.id}`)}
                          className="hover:bg-surface-container-low/60 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-space-md">
                            <div className="flex items-center gap-space-xs">
                              <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0 overflow-hidden shadow-xs">
                                {image ? (
                                  <img src={image} alt={p.name.en} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                  <Icon name="inventory_2" size="sm" />
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span
                                  title={p.name.en}
                                  className="font-title-sm text-title-sm text-on-surface group-hover:text-primary transition-colors truncate max-w-[180px]"
                                >
                                  {p.name.en}
                                </span>
                                {p.slug && (
                                  <span className="font-caption text-caption text-on-surface-variant truncate max-w-[180px]">
                                    {p.slug}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-space-md text-on-surface-variant">
                            {catName}
                          </td>
                          <td className="py-3 px-space-md font-title-sm text-title-sm font-semibold">
                            {formatMoney(p.from_price?.amount_minor ?? null, p.from_price?.currency ?? p.currency)}
                          </td>
                          <td className="py-3 px-space-md text-right">
                            <StatusBadge status={p.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
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
                {categoryStats?.assigned_skus !== undefined && (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-container-high text-on-surface-variant ml-2">
                    {categoryStats.assigned_skus} SKUs in catalogue
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                endIcon="arrow_forward"
                onClick={() => handleNav('category-tree', '/category-tree')}
              >
                Manage {label.lower('categories')}
              </Button>
            </div>

            <div className="p-space-md grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.length === 0 ? (
                <div className="col-span-1 sm:col-span-2 py-8 px-4 text-center flex flex-col items-center justify-center gap-2 border border-dashed border-surface-container rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                    <Icon name="category" size="md" />
                  </div>
                  <span className="text-xs font-semibold text-on-surface">No {label.lower('categories')} loaded</span>
                  <span className="text-xs text-on-surface-variant">Organize your catalog by creating {label.lowerSingular('allProducts')} {label.lower('categories')}.</span>
                  <Button
                    variant="soft"
                    size="sm"
                    startIcon="add"
                    onClick={() => handleNav('category-tree', '/category-tree')}
                  >
                    Add {label.singular('categories')}
                  </Button>
                </div>
              ) : (
                <>
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => handleNav('category-tree', '/category-tree')}
                      className="p-3.5 rounded-xl border border-surface-container bg-surface-container-low/30 hover:bg-surface-container-low/80 hover:border-primary/30 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs overflow-hidden transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: cat.color ? `${cat.color}18` : 'rgba(9, 65, 144, 0.1)',
                            color: cat.color || '#094190',
                          }}
                        >
                          <CategoryIcon value={cat.icon} size={20} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-title-sm text-title-sm text-on-surface font-bold truncate group-hover:text-primary transition-colors">
                            {cat.name.en}
                          </span>
                          <span className="font-caption text-caption text-on-surface-variant truncate" title={cat.description?.en}>
                            {cat.description?.en || `${cat.code} category`}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-surface-container text-primary shrink-0 ml-2 shadow-2xs">
                        {cat.product_count ?? 0} {cat.product_count === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  ))}

                  {/* Balanced quick-action card when only 1 category exists */}
                  {categories.length === 1 && (
                    <div
                      onClick={() => handleNav('category-tree', '/category-tree')}
                      className="p-3.5 rounded-xl border border-dashed border-surface-container hover:border-primary/50 bg-surface-container-low/20 hover:bg-surface-container-low/60 transition-all cursor-pointer flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                        <Icon name="add" size="md" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors">
                          Add new category
                        </span>
                        <span className="font-caption text-caption text-on-surface-variant truncate">
                          Create subcategories or new lines
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
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
                  Upcoming {label.plural('schedule')}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                endIcon="arrow_forward"
                onClick={() => handleNav('schedule', '/schedule')}
              >
                View {label.lower('schedule')}
              </Button>
            </div>

            <div className="divide-y divide-surface-container-low">
              {recentAppointments.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant text-sm">
                  No upcoming {label.lower('schedule')} events scheduled.
                </div>
              ) : (
                recentAppointments.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => {
                      if (setSelectedScheduleEvent) setSelectedScheduleEvent(app);
                      handleNav('schedule', '/schedule');
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
                ))
              )}
            </div>
          </div>

          {/* Card 2: Active Conversations Preview */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden flex flex-col">
            <div className="px-space-md py-space-sm bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-space-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-600"></div>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold tracking-tight">
                  Active {label.plural('conversations')}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                endIcon="arrow_forward"
                onClick={() => handleNav('conversations', '/conversations')}
              >
                Open inbox
              </Button>
            </div>

            <div className="divide-y divide-surface-container-low">
              {recentConversations.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant text-sm">
                  No active conversations found.
                </div>
              ) : (
                recentConversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (setSelectedConversationId) setSelectedConversationId(c.id);
                      handleNav('conversations', `/conversations/${c.id}`);
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
                          {c.lastMessage || c.summary || 'No recent messages'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full font-label-sm text-caption bg-surface-container-high text-primary font-semibold shrink-0 ml-2">
                      {c.channelLabel || c.channel}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
