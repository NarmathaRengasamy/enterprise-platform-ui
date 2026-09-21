import React, { useRef, useState } from 'react';

// Every offering or option carries one primary image, any number of supporting
// images, and video assets. These helpers keep that shape consistent everywhere.
export const createEmptyMedia = () => ({ primary: null, gallery: [], videos: [] });

export const flattenMedia = (media) =>
  media ? [media.primary, ...(media.gallery || []), ...(media.videos || [])].filter(Boolean) : [];

export const countMedia = (media) =>
  media ? (media.primary ? 1 : 0) + (media.gallery?.length || 0) + (media.videos?.length || 0) : 0;

export const releasePreviews = (items) =>
  items.forEach((m) => {
    if (m.src && m.src.startsWith('blob:')) URL.revokeObjectURL(m.src);
  });

// Turn picked files into previewable entries, keeping only the kind a slot accepts
const buildMediaItems = (fileList, kind) =>
  Array.from(fileList || [])
    .filter((f) => f.type.startsWith(`${kind}/`))
    .map((f, i) => ({
      id: `media-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name,
      kind,
      mime: f.type,
      size: f.size,
      src: URL.createObjectURL(f)
    }));

/**
 * Primary image / additional images / video assets, as three separate slots.
 * Fully controlled: `media` is the current value, `onChange` receives the next one.
 */
export default function VisualAssetsUploader({
  media,
  onChange,
  heading = 'Visual Assets',
  // A narrow column (the side rail) reads better with a large primary preview
  largePrimary = false
}) {
  const value = media || createEmptyMedia();
  const { primary, gallery = [], videos = [] } = value;

  const [draggingZone, setDraggingZone] = useState(null);
  const primaryInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const emit = (patch) => onChange({ ...value, ...patch });

  const handleSetPrimary = (fileList) => {
    const [item] = buildMediaItems(fileList, 'image');
    if (item) emit({ primary: item });
  };

  const handleAddGallery = (fileList) => {
    const items = buildMediaItems(fileList, 'image');
    if (items.length > 0) emit({ gallery: [...gallery, ...items] });
  };

  const handleAddVideos = (fileList) => {
    const items = buildMediaItems(fileList, 'video');
    if (items.length > 0) emit({ videos: [...videos, ...items] });
  };

  // Promote a supporting image to primary, demoting the current one into the gallery
  const handlePromoteToPrimary = (mediaId) => {
    const target = gallery.find((m) => m.id === mediaId);
    if (!target) return;
    emit({
      primary: target,
      gallery: gallery.filter((m) => m.id !== mediaId).concat(primary ? [primary] : [])
    });
  };

  const totalCount = countMedia(value);

  const dropZoneClass = (zone) =>
    `border-2 border-dashed rounded-xl p-3.5 flex items-center justify-center gap-2 text-center transition-all cursor-pointer ${
      draggingZone === zone
        ? 'border-primary bg-primary/5'
        : 'border-outline-variant hover:border-primary bg-surface-container-low/30 hover:bg-surface-container-low/60'
    }`;

  // Shared drag/keyboard wiring for a drop zone that opens `ref` on activation
  const zoneProps = (zone, ref, onFiles) => ({
    role: 'button',
    tabIndex: 0,
    onClick: () => ref.current?.click(),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ref.current?.click();
      }
    },
    onDragOver: (e) => {
      e.preventDefault();
      setDraggingZone(zone);
    },
    onDragLeave: () => setDraggingZone(null),
    onDrop: (e) => {
      e.preventDefault();
      setDraggingZone(null);
      onFiles(e.dataTransfer.files);
    },
    className: dropZoneClass(zone)
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">photo_library</span>
          <h4 className="font-title-sm text-title-sm text-on-surface font-semibold">{heading}</h4>
        </div>
        <span className="font-caption text-caption text-outline">
          {totalCount} file{totalCount === 1 ? '' : 's'} attached
        </span>
      </div>

      {/* ---------- Primary Image ---------- */}
      <div className="flex flex-col gap-1.5">
        <label className="font-label-md text-label-md text-on-surface font-medium">Primary Image</label>
        <p className="font-caption text-caption text-on-surface-variant -mt-0.5">
          The lead visual shown in catalog listings and search results.
        </p>

        <input
          ref={primaryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleSetPrimary(e.target.files);
            e.target.value = '';
          }}
        />

        {primary ? (
          largePrimary ? (
            <div className="relative group rounded-xl overflow-hidden aspect-square bg-surface-container-low border border-surface-container-high">
              <img src={primary.src} alt={primary.name} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-2 flex items-center gap-1.5 bg-gradient-to-t from-on-surface/70 to-transparent">
                <span className="font-caption text-caption text-white font-medium truncate flex-1">
                  {primary.name}
                </span>
                <button
                  type="button"
                  onClick={() => primaryInputRef.current?.click()}
                  className="px-2 h-7 rounded-lg font-label-sm text-label-sm bg-surface-container-lowest/95 text-primary hover:bg-surface-container-lowest transition-colors cursor-pointer shrink-0"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => emit({ primary: null })}
                  className="w-7 h-7 rounded-lg bg-surface-container-lowest/95 text-error hover:bg-error-container flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Remove primary image"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low/50 border border-surface-container-high">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-container shrink-0 border border-surface-container-high">
                <img src={primary.src} alt={primary.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                  {primary.name}
                </span>
                <span className="font-caption text-caption text-on-surface-variant">
                  {(primary.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => primaryInputRef.current?.click()}
                  className="px-2.5 h-8 rounded-lg font-label-sm text-label-sm text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => emit({ primary: null })}
                  className="p-1.5 rounded-lg text-error hover:bg-error-container/40 transition-colors cursor-pointer"
                  title="Remove primary image"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
          )
        ) : (
          <div
            {...zoneProps('primary', primaryInputRef, handleSetPrimary)}
            className={`${dropZoneClass('primary')} ${largePrimary ? 'flex-col aspect-[4/3] gap-1' : ''}`}
          >
            <span className={`material-symbols-outlined text-primary ${largePrimary ? 'text-3xl' : 'text-xl'}`}>
              add_photo_alternate
            </span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              {largePrimary ? (
                <>Drop image or <span className="text-primary underline">browse</span></>
              ) : (
                <>Upload primary image — <span className="text-primary underline">browse</span> or drop</>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ---------- Additional Images ---------- */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="font-label-md text-label-md text-on-surface font-medium">Additional Images</label>
          <span className="font-caption text-caption text-outline">{gallery.length} uploaded</span>
        </div>
        <p className="font-caption text-caption text-on-surface-variant -mt-0.5">
          Alternate angles, close-up details or in-context shots. JPG, PNG or WebP.
        </p>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleAddGallery(e.target.files);
            e.target.value = '';
          }}
        />

        <div {...zoneProps('gallery', galleryInputRef, handleAddGallery)}>
          <span className="material-symbols-outlined text-primary text-xl">add_to_photos</span>
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            Add supporting images — <span className="text-primary underline">browse</span> or drop
          </span>
        </div>

        {gallery.length > 0 && (
          <div className="grid grid-cols-4 gap-2 pt-0.5">
            {gallery.map((m) => (
              <div
                key={m.id}
                className="relative group rounded-lg overflow-hidden aspect-square bg-surface-container-low border border-surface-container-high"
                title={m.name}
              >
                <img src={m.src} alt={m.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handlePromoteToPrimary(m.id)}
                  className="absolute bottom-1 left-1 px-1.5 h-5 rounded font-caption text-caption text-[10px] font-semibold bg-surface-container-lowest/90 text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-on-primary"
                  title="Set as primary image"
                >
                  Set primary
                </button>
                <button
                  type="button"
                  onClick={() => emit({ gallery: gallery.filter((g) => g.id !== m.id) })}
                  className="absolute top-1 right-1 w-5 h-5 rounded-md bg-surface-container-lowest/90 text-error opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity hover:bg-error-container"
                  title={`Remove ${m.name}`}
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Video Assets ---------- */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="font-label-md text-label-md text-on-surface font-medium">Video Assets</label>
          <span className="font-caption text-caption text-outline">{videos.length} uploaded</span>
        </div>
        <p className="font-caption text-caption text-on-surface-variant -mt-0.5">
          Demonstrations, walkthroughs or promotional clips. MP4 or WebM.
        </p>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleAddVideos(e.target.files);
            e.target.value = '';
          }}
        />

        <div {...zoneProps('video', videoInputRef, handleAddVideos)}>
          <span className="material-symbols-outlined text-primary text-xl">video_library</span>
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            Add video — <span className="text-primary underline">browse</span> or drop
          </span>
        </div>

        {videos.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-0.5">
            {videos.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-container-low/50 border border-surface-container"
              >
                <div className="relative w-12 h-12 rounded-md overflow-hidden bg-surface-container shrink-0">
                  <video src={m.src} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center text-white">
                    <span className="material-symbols-outlined text-lg drop-shadow">play_circle</span>
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold truncate">{m.name}</span>
                  <span className="font-caption text-caption text-on-surface-variant">
                    {(m.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => emit({ videos: videos.filter((x) => x.id !== m.id) })}
                  className="p-1.5 rounded-lg text-error hover:bg-error-container/40 transition-colors cursor-pointer shrink-0"
                  title={`Remove ${m.name}`}
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
