import React, { Suspense } from 'react';
import { Icon } from './Icon';

/**
 * A category's icon, whichever kind is stored:
 *   "lucide:shirt"  — picked in the icon picker (lucide-react, Oct 2026)
 *   "checkroom"     — an older Material Symbols name; still shown as before
 *   ""              — the default ("category")
 * Colour comes from the surrounding text colour (currentColor).
 */

export const LUCIDE_PREFIX = 'lucide:';

const LucideIcon = React.lazy(() => import('./LucideIcon'));

export const isLucide = (value?: string | null) => Boolean(value?.startsWith(LUCIDE_PREFIX));
export const lucideName = (value: string) => value.slice(LUCIDE_PREFIX.length);

export const CategoryIcon: React.FC<{ value?: string | null; size?: number; className?: string }> = ({ value, size = 20, className }) => {
  if (value && isLucide(value)) {
    return (
      <Suspense fallback={<span style={{ width: size, height: size, display: 'inline-block' }} />}>
        <LucideIcon name={lucideName(value)} size={size} className={className} />
      </Suspense>
    );
  }
  return <Icon name={value || 'category'} size={size} className={className} />;
};

export default CategoryIcon;
