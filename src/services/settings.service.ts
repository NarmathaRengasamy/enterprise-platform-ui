import { API_ORIGIN, client } from './client';

/**
 * One renameable section of the app.
 *
 * `plural` names the section — the menu item, the page heading. `singular`
 * names one of the things in it: "New conversation", "Conversation deleted".
 * Both are stored because no rule reliably turns one into the other; dropping
 * an "s" turns "Enquiries" into "Enquirie".
 */
export interface ModuleLabel {
  plural: string;
  singular: string;
}

export const MODULE_KEYS = [
  'dashboard',
  'conversations',
  'products',
  /* The two entries under Products. Separate keys rather than something
     derived from `products`: a shop that renames Products to "Catalogue" does
     not necessarily want "All Catalogue". */
  'allProducts',
  'categories',
  'schedule',
  'teams',
  'knowledgeBase',
  'developer',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/**
 * The shipped wording.
 *
 * Held here as well as on the server so the app renders correctly on the very
 * first paint, before any request has returned — the sidebar cannot wait for
 * the network to know what to call things.
 */
export const DEFAULT_LABELS: Record<ModuleKey, ModuleLabel> = {
  dashboard: { plural: 'Dashboard', singular: 'Dashboard' },
  conversations: { plural: 'Conversations', singular: 'Conversation' },
  products: { plural: 'Products', singular: 'Product' },
  allProducts: { plural: 'All Products', singular: 'Product' },
  categories: { plural: 'Categories', singular: 'Category' },
  schedule: { plural: 'Schedule', singular: 'Appointment' },
  teams: { plural: 'Teams', singular: 'Member' },
  knowledgeBase: { plural: 'Knowledge Base', singular: 'Article' },
  developer: { plural: 'Developer', singular: 'Endpoint' },
};

/** What a module is called by default — used to spot an un-customised label. */
export const isDefaultLabel = (key: ModuleKey, label: ModuleLabel): boolean =>
  label.plural === DEFAULT_LABELS[key].plural && label.singular === DEFAULT_LABELS[key].singular;

/**
 * A reasonable singular for a plural someone has just typed.
 *
 * Only a guess, and only used to pre-fill the field while it is untouched —
 * the user can always correct it, which is the point of storing both.
 */
export const guessSingular = (plural: string): string => {
  const value = plural.trim();
  if (/ies$/i.test(value)) return value.slice(0, -3) + 'y';
  if (/(s|x|z|ch|sh)es$/i.test(value)) return value.slice(0, -2);
  if (/ss$/i.test(value)) return value;
  if (/s$/i.test(value)) return value.slice(0, -1);
  return value;
};

/**
 * Workspace-wide settings.
 *
 * One document, shared by everyone signed in — not a per-user preference. Any
 * Admin changing these changes them for the whole workspace, which is why the
 * save is Admin-only and the page says so rather than hiding itself.
 */
export interface SiteSettings {
  id: string;

  /* Identity */
  siteName: string;
  legalName: string;
  tagline: string;
  /** A data URL or an absolute URL. Empty means the built-in mark. */
  logoUrl: string;
  faviconUrl: string;

  /* Business */
  businessType: string;

  /** Every module, defaults already merged in by the server. */
  labels: Record<ModuleKey, ModuleLabel>;

  updatedAt?: string;
  updatedBy?: string;
}

export type SiteSettingsPatch = Partial<Omit<SiteSettings, 'id' | 'updatedAt' | 'updatedBy'>>;

/**
 * What the app shows before the server has answered, and if it never does.
 *
 * Branding is chrome: it renders on the very first paint, long before any
 * request resolves. Having a real default here is what stops the sidebar
 * flashing empty on every page load.
 */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: 'site',
  siteName: 'OmniFlow',
  legalName: '',
  tagline: 'Perfox Assistant',
  logoUrl: '',
  faviconUrl: '',
  businessType: '',
  labels: DEFAULT_LABELS,
};

/** The suggestions offered for business type. Free text is still accepted. */
export const BUSINESS_TYPES = [
  'Retail',
  'E-commerce',
  'Manufacturing',
  'Wholesale / Distribution',
  'Professional services',
  'Healthcare',
  'Education',
  'Hospitality',
  'Real estate',
  'Logistics',
  'Finance',
  'Non-profit',
  'Other',
];

/** What the unauthenticated endpoint publishes: branding and section names. */
export type PublicSiteSettings = Pick<
  SiteSettings,
  'siteName' | 'tagline' | 'logoUrl' | 'faviconUrl' | 'labels'
>;

export const settingsService = {
  async getSite(): Promise<SiteSettings> {
    const res = await client.get<SiteSettings>('/settings/site');
    return { ...DEFAULT_SITE_SETTINGS, ...(res.data ?? {}) };
  },

  /**
   * Branding for screens that render before anyone has signed in.
   *
   * The sign-in page has no token, so it cannot use the call above — and
   * without this it showed the shipped "OmniFlow" wording to a workspace that
   * had renamed itself. Deliberately not `client`, which attaches the bearer
   * token and would fail the request when there is none.
   *
   * The server publishes branding only. The legal name, the business category
   * and who last saved stay behind the authenticated read.
   */
  async getPublicSite(): Promise<SiteSettings> {
    const res = await fetch(`${API_ORIGIN}/public/settings`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not load the workspace branding (${res.status})`);
    const body = (await res.json()) as { data?: PublicSiteSettings };
    return { ...DEFAULT_SITE_SETTINGS, ...(body.data ?? {}) };
  },

  /**
   * Saves only the keys passed.
   *
   * A partial patch rather than the whole object, so one tab of the settings
   * screen can never blank a field belonging to another tab it did not render.
   */
  async updateSite(patch: SiteSettingsPatch): Promise<SiteSettings> {
    const res = await client.put<SiteSettings>('/settings/site', patch);
    return { ...DEFAULT_SITE_SETTINGS, ...(res.data ?? {}) };
  },
};

export default settingsService;
