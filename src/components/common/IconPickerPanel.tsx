import React, { useMemo, useState } from 'react';
import { iconNames } from 'lucide-react/dynamic';
import LucideIcon from './LucideIcon';

/**
 * The icon picker's panel (lazy: the list of ~1,500 lucide names loads only
 * when the picker opens). Opens on "Popular for shops"; the search matches the
 * icon names ("shoe", "car", "phone"…).
 */

const POPULAR = [
  'shirt', 'footprints', 'shopping-bag', 'handbag', 'watch', 'gem', 'glasses', 'crown',
  'car', 'car-front', 'bike', 'bus', 'truck', 'fuel', 'wrench', 'cog',
  'smartphone', 'laptop', 'monitor', 'headphones', 'camera', 'tv', 'gamepad-2', 'cpu',
  'sofa', 'bed', 'lamp', 'armchair', 'cooking-pot', 'utensils', 'refrigerator', 'washing-machine',
  'apple', 'carrot', 'milk', 'coffee', 'cake', 'pizza', 'beef', 'wine',
  'sparkles', 'spray-can', 'brush', 'scissors', 'baby', 'toy-brick', 'puzzle', 'book-open',
  'pencil', 'dumbbell', 'trophy', 'pill', 'heart-pulse', 'stethoscope', 'paw-print', 'dog',
  'flower-2', 'leaf', 'gift', 'tag', 'package', 'box', 'store', 'star',
];

const MAX_RESULTS = 120;

const IconPickerPanel: React.FC<{ value: string; onPick: (name: string) => void }> = ({ value, onPick }) => {
  const [query, setQuery] = useState('');
  const all = iconNames as string[];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '-');
    if (!q) return POPULAR.filter((n) => all.includes(n));
    return all.filter((n) => n.includes(q)).slice(0, MAX_RESULTS);
  }, [query, all]);

  return (
    <div className="flex flex-col gap-2">
      <input
        aria-label="Search icons"
        autoFocus
        className="w-full h-9 px-3 rounded-lg bg-surface-container-low border border-surface-container-high text-sm focus:outline-none focus:border-primary"
        placeholder="Search icons… (e.g. shoe, car, phone)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="text-[11px] text-on-surface-variant">{query.trim() ? `${shown.length}${shown.length === MAX_RESULTS ? '+' : ''} found` : 'Popular for shops'}</p>
      <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto" role="listbox" aria-label="Icons">
        {shown.map((n) => (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={value === n}
            aria-label={n}
            title={n}
            onClick={() => onPick(n)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              value === n ? 'bg-primary/10 text-primary ring-2 ring-primary/50' : 'text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <LucideIcon name={n} size={18} />
          </button>
        ))}
        {shown.length === 0 && <p className="col-span-8 text-xs text-on-surface-variant py-2">No icon matches.</p>}
      </div>
    </div>
  );
};

export default IconPickerPanel;
