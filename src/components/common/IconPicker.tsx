import React, { Suspense, useEffect, useRef, useState } from 'react';
import { CategoryIcon, isLucide, lucideName, LUCIDE_PREFIX } from './CategoryIcon';

/**
 * Pick an icon (lucide-react) instead of typing a name. Closed: a button with
 * the chosen icon. Open: a small panel under it — search + grid, "Default
 * icon" to clear. Saves "lucide:<name>"; an older typed name is shown as
 * "Custom" until another icon is picked.
 */

const IconPickerPanel = React.lazy(() => import('./IconPickerPanel'));

export const IconPicker: React.FC<{
  value: string;
  onChange: (next: string) => void;
  /** The category's colour, so the icon is seen as it will look. */
  color?: string;
  label?: string;
}> = ({ value, onChange, color, label = 'Icon' }) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const name = !value ? 'Default' : isLucide(value) ? lucideName(value) : `${value} (custom)`;

  return (
    <div
      className="relative"
      ref={boxRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center gap-2 text-sm text-on-surface hover:border-primary/50 focus:outline-none focus:border-primary"
      >
        <span className="w-6 h-6 rounded-md bg-surface-container-high flex items-center justify-center shrink-0" style={color ? { color } : undefined}>
          <CategoryIcon value={value} size={16} />
        </span>
        <span className="flex-1 text-left truncate">{name}</span>
        <span className="material-symbols-outlined text-base text-on-surface-variant" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute z-[70] mt-1 left-0 w-[22rem] max-w-[90vw] rounded-xl border border-surface-container-high bg-surface-container-lowest shadow-2xl p-3 flex flex-col gap-2">
          <Suspense fallback={<p className="text-xs text-on-surface-variant py-4 text-center">Loading icons…</p>}>
            <IconPickerPanel
              value={isLucide(value) ? lucideName(value) : ''}
              onPick={(n) => {
                onChange(`${LUCIDE_PREFIX}${n}`);
                setOpen(false);
              }}
            />
          </Suspense>
          <button
            type="button"
            className="self-start flex items-center gap-1 text-xs font-medium text-primary"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              restart_alt
            </span>
            Default icon
          </button>
        </div>
      )}
    </div>
  );
};

export default IconPicker;
