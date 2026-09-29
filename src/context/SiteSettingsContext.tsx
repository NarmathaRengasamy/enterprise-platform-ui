import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getToken } from '../services/client';
import { useAuth } from '../hooks/useAuth';
import settingsService, {
  DEFAULT_LABELS,
  DEFAULT_SITE_SETTINGS,
  ModuleKey,
  ModuleLabel,
  SiteSettings,
  SiteSettingsPatch,
} from '../services/settings.service';

/**
 * The workspace's own name, logo and tagline, available to the whole app.
 *
 * It lives in a context rather than being fetched per screen because the
 * branding is chrome — the sidebar, the browser tab and the login screen all
 * want it, and they render on every route. Fetching it in each of them would
 * mean the same request several times on one page load.
 *
 * A failure is deliberately silent: if the settings cannot be read, the app
 * shows its built-in defaults and carries on. Branding is not worth an error
 * banner across every screen.
 */

interface SiteSettingsValue {
  settings: SiteSettings;
  /** False until the first load settles, for anything that must not flash. */
  loaded: boolean;
  /**
   * Whether `settings` came from the server.
   *
   * False means the read failed and these are the built-in defaults. The
   * chrome is happy either way, but **saving must be blocked**: a form seeded
   * from defaults that it believes are real would write "OmniFlow" over
   * whatever the workspace actually had.
   */
  available: boolean;
  loadError: string | null;
  save: (patch: SiteSettingsPatch) => Promise<SiteSettings>;
  reload: () => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsValue>({
  settings: DEFAULT_SITE_SETTINGS,
  loaded: false,
  available: false,
  loadError: null,
  save: async () => DEFAULT_SITE_SETTINGS,
  reload: async () => undefined,
});

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      /**
       * Signed out, ask the public endpoint.
       *
       * The sign-in screen has no token, so the authenticated read 401s — and
       * the fallback defaults meant a workspace that had renamed itself still
       * greeted people with "OmniFlow". The public endpoint publishes
       * branding only; nothing private reaches a page anyone can open.
       */
      setSettings(getToken() ? await settingsService.getSite() : await settingsService.getPublicSite());
      setAvailable(true);
      setLoadError(null);
    } catch (e: any) {
      /* The chrome keeps its defaults and no banner appears on every screen —
         but `available` stays false so the settings form refuses to save over
         values it never managed to read. */
      setAvailable(false);
      setLoadError(e?.message ?? 'Could not reach the server');
    } finally {
      setLoaded(true);
    }
  }, []);

  /* Signing in upgrades the public read to the full one; signing out drops
     back. Without this the branding would keep whatever it fetched on the
     very first paint for the rest of the session. */
  useEffect(() => {
    void reload();
  }, [reload, isAuthenticated]);

  /* A save returns the saved document, so the sidebar updates the moment the
     form does — no reload, and no chance of the two disagreeing. */
  const save = useCallback(async (patch: SiteSettingsPatch) => {
    const next = await settingsService.updateSite(patch);
    setSettings(next);
    setAvailable(true);
    setLoadError(null);
    return next;
  }, []);

  /* The browser tab follows the workspace name and favicon. This is the point
     of the whole screen: a setting nothing reads is decoration. */
  useEffect(() => {
    document.title = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  }, [settings.siteName]);

  useEffect(() => {
    if (!settings.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = settings.faviconUrl;
  }, [settings.faviconUrl]);

  const value = useMemo(
    () => ({ settings, loaded, available, loadError, save, reload }),
    [settings, loaded, available, loadError, save, reload]
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
};

export const useSiteSettings = (): SiteSettingsValue => useContext(SiteSettingsContext);

/**
 * What this workspace calls each part of the app.
 *
 * The reason screens call this instead of writing the word: a rename has to
 * reach every place the word appears, and it cannot do that if each screen
 * states the word itself.
 *
 *   const label = useLabels();
 *   label.plural('conversations')     // "Interactions"
 *   label.singular('conversations')   // "Interaction"
 *   label.lower('conversations')      // "interactions", for mid-sentence
 *
 * Falls back to the shipped wording whenever the settings have not loaded, so
 * nothing ever renders blank or flashes a placeholder.
 */
export const useLabels = () => {
  const { settings } = useSiteSettings();

  const get = (key: ModuleKey): ModuleLabel =>
    settings.labels?.[key] ?? DEFAULT_LABELS[key];

  return {
    get,
    plural: (key: ModuleKey) => get(key).plural,
    singular: (key: ModuleKey) => get(key).singular,
    /* For the middle of a sentence — "No interactions yet". Only lowercased
       when the label is a plain word: a workspace that renames something to
       "CRM Records" means those capitals. */
    lower: (key: ModuleKey) => {
      const value = get(key).plural;
      return /^[A-Z][a-z]+$/.test(value) ? value.toLowerCase() : value;
    },
    lowerSingular: (key: ModuleKey) => {
      const value = get(key).singular;
      return /^[A-Z][a-z]+$/.test(value) ? value.toLowerCase() : value;
    },
  };
};

export default SiteSettingsContext;
