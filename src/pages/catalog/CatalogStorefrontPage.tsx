import React, { useEffect, useState } from 'react';
import { Badge, Button, Icon } from '../../components/common';
import { ErrorBanner, LoadingState, SuccessBanner } from '../../components/catalog/primitives';
import storeService, { STORE_API } from '../../services/store.service';

/**
 * The Storefront tab.
 *
 * Two jobs: hand the public API to whoever is building a site, and let you see
 * what a customer currently sees. The numbers are fetched through the public
 * endpoints rather than the admin ones, so this page proves the storefront
 * works rather than just describing it.
 */

interface Endpoint {
  method: 'GET' | 'POST';
  path: string;
  what: string;
  body?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST',
    path: '/products',
    what: 'The listing. Filters, facets, paging. Newest first.',
    body: `{
  "search": "iphone",
  "categoryId": "<category uuid>",
  "attributes": { "colour": ["Black"] },
  "inStockOnly": true,
  "page": 1,
  "limit": 12,
  "facets": true
}`,
  },
  {
    method: 'GET',
    path: '/products/:id',
    what: 'One product with every variant, price and availability.',
  },
  {
    method: 'GET',
    path: '/categories?tree=true',
    what: 'Categories with a live product count. Omit tree for a flat list.',
  },
  {
    method: 'GET',
    path: '/items/:itemId/charges',
    what: 'Full price breakdown for one variant: base, required, optional.',
  },
];

export default function CatalogStorefrontPage(): JSX.Element {
  const [counts, setCounts] = useState<{ products: number; categories: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([storeService.products({ limit: 1 }), storeService.categories()])
      .then(([page, cats]) => setCounts({ products: page.total, categories: cats.length }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const curlFor = (e: Endpoint): string => {
    const url = `${STORE_API}${e.path}`;
    if (e.method === 'GET') return `curl '${url}'`;
    return `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${
      (e.body ?? '{}').replace(/\n/g, '\n  ')
    }'`;
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError('Could not copy — your browser blocked clipboard access.');
    }
  };

  if (loading) return <LoadingState label="Checking the storefront…" />;

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
            Storefront
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 max-w-3xl">
            A public, read-only API any website can call without a login — and a customer site
            already built on it. Only products marked <strong>active</strong> are published.
          </p>
        </div>
        <Button
          variant="primary"
          startIcon="open_in_new"
          onClick={() => window.open('/store', '_blank')}
        >
          Open customer site
        </Button>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <SuccessBanner
        message={copied ? 'Copied to the clipboard.' : null}
        onDismiss={() => setCopied(null)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <section className="space-y-4">
          {/* ------------------------------------------------ base url */}
          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-2">
              Base URL
            </h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 rounded-xl bg-surface-container text-sm text-on-surface font-mono break-all">
                {STORE_API}
              </code>
              <Button
                size="icon-sm"
                variant="outline"
                title="Copy"
                startIcon="content_copy"
                onClick={() => copy(STORE_API, 'base')}
              />
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2">
              No API key, no token. Rate limited to{' '}
              <strong>120 requests per minute per address</strong> — raise it with{' '}
              <code>PUBLIC_API_RATE_LIMIT</code>.
            </p>
          </div>

          {/* ----------------------------------------------- endpoints */}
          <div className="bg-surface rounded-2xl border border-outline-variant/40 overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/40">
              <h2 className="text-sm font-bold text-on-surface">Endpoints</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Four calls are enough to build a whole shop.
              </p>
            </div>

            <div className="divide-y divide-outline-variant/40">
              {ENDPOINTS.map((e) => {
                const key = e.method + e.path;
                const isOpen = open === key;
                return (
                  <div key={key} className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Badge variant={e.method === 'GET' ? 'secondary' : 'primary'} size="sm">
                        {e.method}
                      </Badge>
                      <code className="text-sm font-mono text-on-surface flex-1 truncate">
                        {e.path}
                      </code>
                      <Button
                        size="xs"
                        variant="ghost"
                        startIcon={isOpen ? 'expand_less' : 'expand_more'}
                        onClick={() => setOpen(isOpen ? null : key)}
                      >
                        curl
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Copy curl"
                        startIcon="content_copy"
                        onClick={() => copy(curlFor(e), key)}
                      />
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1.5 ml-[4.5rem]">{e.what}</p>

                    {isOpen && (
                      <pre className="mt-3 p-3.5 rounded-xl bg-surface-container text-[11px] font-mono text-on-surface overflow-x-auto whitespace-pre-wrap">
                        {curlFor(e)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* --------------------------------------------- what leaves */}
          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
            <h2 className="text-sm font-bold text-on-surface mb-3">What the public sees</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-secondary mb-1.5">Published</p>
                <ul className="space-y-1 text-on-surface-variant">
                  <li>• name, SKU, brand, description</li>
                  <li>• variants with their prices</li>
                  <li>• availability as a phrase</li>
                  <li>• required and optional charges</li>
                  <li>• filterable attributes only</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-error mb-1.5">Never leaves</p>
                <ul className="space-y-1 text-on-surface-variant">
                  <li>• draft and archived products</li>
                  <li>• deleted rows of any kind</li>
                  <li>• internal ids — typeId, is_deleted</li>
                  <li>• price lists, quantity bands, stock counts</li>
                  <li>• which category a charge came from</li>
                </ul>
              </div>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3.5 pt-3.5 border-t border-outline-variant/40">
              The public shape is built field by field in <code>publicCatalogV2.ts</code>. A new
              internal field is invisible by default rather than needing to be remembered.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------- sidebar */}
        <aside className="space-y-4">
          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-3">
              Live right now
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Published products</span>
                <span className="text-xl font-bold text-on-surface">{counts?.products ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Categories</span>
                <span className="text-xl font-bold text-on-surface">{counts?.categories ?? 0}</span>
              </div>
            </div>
            {counts?.products === 0 && (
              <p className="text-[11px] text-on-surface-variant mt-3 pt-3 border-t border-outline-variant/40">
                Nothing is published. Set a product's status to <strong>Active</strong> and it
                appears on the shop immediately.
              </p>
            )}
          </div>

          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-3">
              Customer site
            </h2>
            <div className="space-y-2">
              {[
                { path: '/store', label: 'Landing page', icon: 'home' },
                { path: '/store/products', label: 'Shop listing', icon: 'grid_view' },
              ].map((l) => (
                <button
                  key={l.path}
                  type="button"
                  onClick={() => window.open(l.path, '_blank')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-outline-variant/50 hover:bg-surface-container-low transition-colors text-left"
                >
                  <Icon name={l.icon} size="sm" color="outline" />
                  <span className="text-sm text-on-surface flex-1">{l.label}</span>
                  <Icon name="open_in_new" size="xs" color="outline" />
                </button>
              ))}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3">
              Runs in this same app on public routes — no login, no admin code.
            </p>
          </div>

          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-2">
              Read only
            </h2>
            <p className="text-xs text-on-surface-variant">
              There is no public write of any kind. Nothing reachable from a website can change
              your catalogue, so the worst a misbehaving client can do is read published data —
              and get rate limited.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
