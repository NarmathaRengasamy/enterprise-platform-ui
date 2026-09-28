import React, { useRef, useState } from 'react';
import { Badge, Button, Icon } from '../common';
import { ErrorBanner, inputClass } from './primitives';
import { mediaService, mediaUrl } from '../../services/catalog.service';
import { MediaAsset, MediaConfig } from '../../types/catalog.types';

/**
 * Pictures and videos for a product or a variant.
 *
 * Uploading and attaching are separate steps on purpose: files go to the
 * server immediately, but nothing is bound to the product until it is saved.
 * That way a failed save leaves a loose file rather than a half-edited
 * product, and the user can reorder and re-pick a thumbnail freely first.
 */

interface Props {
  config?: MediaConfig;
  value: MediaAsset[];
  onChange: (next: MediaAsset[]) => void;
  /** A variant may leave this empty and fall back to the product's. */
  variant?: boolean;
  label?: string;
}

const isYouTubeOrVimeo = (url: string) =>
  /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|player\.vimeo\.com\/video\/|vimeo\.com\/)/i.test(
    url
  );

export const MediaManager: React.FC<Props> = ({ config, value, onChange, variant, label }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  /* Files uploaded since this form opened and not yet saved to anything.
     Dropping one of these has to delete it here, because no later save will
     ever look at it — that is the one case the server cannot clean up. */
  const unsaved = useRef(new Map<string, string>());

  const images = config?.images.enabled ?? false;
  const videos = config?.videos.enabled ?? false;
  if (!images && !videos) return null;

  const list = [...value].sort((a, b) => a.sort - b.sort);
  const imageCount = list.filter((a) => a.kind === 'image').length;

  /** Renumbers and keeps exactly one thumbnail, mirroring the server. */
  const commit = (next: MediaAsset[]) => {
    const renumbered = next.map((a, i) => ({ ...a, sort: i }));
    const imgs = renumbered.filter((a) => a.kind === 'image');
    if (imgs.length && !imgs.some((a) => a.isThumbnail)) {
      const first = imgs[0];
      for (const a of renumbered) a.isThumbnail = a.kind === 'image' && a.id === first.id;
    }
    onChange(renumbered);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const stored = await mediaService.upload(Array.from(files));
      for (const asset of stored) {
        if (asset.filename) unsaved.current.set(asset.id, asset.filename);
      }
      commit([...list, ...stored.map((s, i) => ({ ...s, sort: list.length + i }))]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (imageInput.current) imageInput.current.value = '';
      if (videoInput.current) videoInput.current.value = '';
    }
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    if (!isYouTubeOrVimeo(url)) {
      setError('That must be a YouTube or Vimeo link. Upload the file instead if it is hosted elsewhere.');
      return;
    }
    commit([
      ...list,
      {
        id: crypto.randomUUID(),
        kind: 'video',
        url,
        source: 'link',
        sort: list.length,
      },
    ]);
    setLinkUrl('');
    setError(null);
  };

  const remove = (id: string) => {
    const filename = unsaved.current.get(id);
    if (filename) {
      unsaved.current.delete(id);
      /* Nothing waits on this: the list should update at once, and a file that
         survives a failed delete is a wasted megabyte, not a broken product. */
      void mediaService.remove(filename).catch(() => undefined);
    }
    commit(list.filter((a) => a.id !== id));
  };

  const setThumbnail = (id: string) =>
    commit(list.map((a) => ({ ...a, isThumbnail: a.kind === 'image' && a.id === id })));

  /* Drag to reorder. Plain HTML5 drag-and-drop rather than a library — the
     list is short and this adds no dependency. */
  const onDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const from = list.findIndex((a) => a.id === draggedId);
    const to = list.findIndex((a) => a.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
    setDraggedId(null);
  };

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-on-surface-variant">{label}</span>
          {config?.images.required && !variant && (
            <Badge variant={imageCount ? 'secondary' : 'error'} size="sm">
              {imageCount ? 'image added' : 'image required'}
            </Badge>
          )}
        </div>
      )}

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* ------------------------------------------------------ drop zone */}
      {images && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-outline-variant/60 hover:border-outline-variant'
          }`}
        >
          <Icon name="add_photo_alternate" size="lg" color="outline" />
          <p className="text-sm text-on-surface mt-1.5">
            Drop images here, or{' '}
            <button
              type="button"
              onClick={() => imageInput.current?.click()}
              className="text-primary font-semibold hover:underline"
            >
              browse
            </button>
          </p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            JPEG, PNG, WebP, GIF or AVIF · up to 10 MB each
          </p>
          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void upload(e.target.files)}
          />
        </div>
      )}

      {/* --------------------------------------------------------- videos */}
      {videos && !variant && (
        <div className="flex items-center gap-2">
          <input
            className={inputClass}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder="Paste a YouTube or Vimeo link"
          />
          <Button variant="outline" onClick={addLink} disabled={!linkUrl.trim()}>
            Add
          </Button>
          <Button
            variant="ghost"
            startIcon="movie"
            onClick={() => videoInput.current?.click()}
            title="Upload a video file"
          >
            Upload
          </Button>
          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => void upload(e.target.files)}
          />
        </div>
      )}

      {busy && <p className="text-xs text-on-surface-variant">Uploading…</p>}

      {/* ---------------------------------------------------------- list */}
      {list.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {list.map((asset) => (
              <div
                key={asset.id}
                draggable
                onDragStart={() => setDraggedId(asset.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(asset.id)}
                className={`relative rounded-xl border overflow-hidden group cursor-move ${
                  asset.isThumbnail ? 'border-primary ring-2 ring-primary/25' : 'border-outline-variant/50'
                }`}
              >
                <div className="aspect-square bg-surface-container flex items-center justify-center">
                  {asset.kind === 'image' ? (
                    <img
                      src={mediaUrl(asset.url)}
                      alt={asset.alt ?? ''}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center px-2">
                      <Icon name="play_circle" size="xl" color="outline" />
                      <p className="text-[10px] text-on-surface-variant mt-1 break-all line-clamp-2">
                        {asset.source === 'link' ? 'Linked video' : 'Video file'}
                      </p>
                    </div>
                  )}
                </div>

                {asset.isThumbnail && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-primary text-on-primary text-[10px] font-semibold">
                    Thumbnail
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 px-1.5 py-1 bg-black/55 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {asset.kind === 'image' && !asset.isThumbnail ? (
                    <button
                      type="button"
                      onClick={() => setThumbnail(asset.id)}
                      className="text-[10px] text-white font-medium hover:underline"
                    >
                      Make thumbnail
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/70">#{asset.sort + 1}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(asset.id)}
                    aria-label="Remove"
                    className="w-5 h-5 rounded flex items-center justify-center text-white hover:bg-white/20"
                  >
                    <Icon name="close" size="xs" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-on-surface-variant">
            Drag to reorder — that is the order customers see. The thumbnail is the cover image on
            listings; it does not have to be first.
          </p>
        </>
      )}
    </div>
  );
};

export default MediaManager;
