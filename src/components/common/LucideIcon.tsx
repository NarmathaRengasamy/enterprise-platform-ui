import React from 'react';
import { DynamicIcon } from 'lucide-react/dynamic';

/**
 * One lucide icon by its kebab-case name ("shirt", "car-front"). Each icon file
 * loads on demand, so the full set never weighs on a page. Loaded lazily itself
 * (see CategoryIcon / IconPicker) — pages without lucide icons never fetch it.
 */
const LucideIcon: React.FC<{ name: string; size?: number; className?: string }> = ({ name, size = 20, className }) => (
  <DynamicIcon name={name as any} size={size} className={className} strokeWidth={1.75} fallback={() => <span style={{ width: size, height: size, display: 'inline-block' }} />} />
);

export default LucideIcon;
