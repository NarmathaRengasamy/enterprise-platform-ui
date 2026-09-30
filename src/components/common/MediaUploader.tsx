import React, { useRef, useState } from 'react';
import { checkMediaFile, mediaService, UploadedMedia } from '../../services/media.service';
import { resolveAssetUrl } from '../../utils/assetUrl';

export interface MediaItem {
  url: string;
  kind: 'image' | 'video';
}

export interface MediaUploaderProps {
  value: MediaItem[];
  onChange: (next: MediaItem[]) => void;
  accept?: Array<'image' | 'video'>;
  /** Maximum number of files; omit for no limit. */
  max?: number;
  disabled?: boolean;
  label?: string;
  /** Injected in tests; defaults to the real upload. */
  upload?: (file: File) => Promise<UploadedMedia>;
}

/**
 * Uploads product media and keeps only server URLs.
 *
 * The old product form stored `URL.createObjectURL` results — `blob:` URLs that
 * died with the tab — so every image vanished on reload. Here nothing enters
 * `value` until the server has stored the file and answered with its URL, and
 * the preview is drawn from that URL, never from a local blob.
 */
export const MediaUploader: React.FC<MediaUploaderProps> = ({
  value,
  onChange,
  accept = ['image'],
  max,
  disabled = false,
  label = 'Media',
  upload = mediaService.upload,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const atLimit = typeof max === 'number' && value.length >= max;
  const acceptAttr = accept
    .flatMap((k) => (k === 'image' ? ['image/png', 'image/jpeg', 'image/webp'] : ['video/mp4', 'video/quicktime']))
    .join(',');

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);

    const room = typeof max === 'number' ? Math.max(0, max - value.length) : files.length;
    const chosen = Array.from(files).slice(0, room);
    if (chosen.length < files.length) setError(`Only ${max} file${max === 1 ? '' : 's'} allowed`);

    const added: MediaItem[] = [];
    for (const file of chosen) {
      const problem = checkMediaFile(file, accept);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const stored = await upload(file);
        added.push({ url: stored.url, kind: stored.kind });
      } catch (e: any) {
        setError(`${file.name}: ${e?.message || 'Upload failed'}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added.length) onChange([...value, ...added]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-2" data-testid="media-uploader">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">{label}</span>
        {busy > 0 && (
          <span className="text-xs text-on-surface-variant" role="status">
            Uploading…
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {value.map((item, index) => {
          const src = resolveAssetUrl(item.url);
          return (
            <div
              key={`${item.url}-${index}`}
              className="relative w-24 h-24 rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low"
            >
              {item.kind === 'video' ? (
                <video src={src} className="w-full h-full object-cover" muted aria-label={`Video ${index + 1}`} />
              ) : (
                <img src={src} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove media ${index + 1}`}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs leading-6"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {!disabled && !atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy > 0}
            className="w-24 h-24 rounded-lg border-2 border-dashed border-outline-variant text-on-surface-variant text-xs flex items-center justify-center hover:bg-surface-container-high disabled:opacity-50"
          >
            + Add
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        multiple={max !== 1}
        className="hidden"
        data-testid="media-uploader-input"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default MediaUploader;
