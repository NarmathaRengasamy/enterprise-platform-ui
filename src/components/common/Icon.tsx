import React from 'react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
export type IconColor = 'primary' | 'secondary' | 'tertiary' | 'muted' | 'outline' | 'error' | 'inherit';

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: IconSize;
  fill?: boolean;
  spin?: boolean;
  color?: IconColor;
  className?: string;
}

const sizeMap: Record<string, string> = {
  xs: 'text-[14px]',
  sm: 'text-[16px]',
  md: 'text-[18px]',
  lg: 'text-[20px]',
  xl: 'text-[24px]',
  '2xl': 'text-[32px]'
};

const colorMap: Record<IconColor, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  muted: 'text-on-surface-variant',
  outline: 'text-outline',
  error: 'text-error',
  inherit: 'text-inherit'
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  fill = false,
  spin = false,
  color = 'inherit',
  className = '',
  style,
  ...props
}) => {
  const sizeClass = typeof size === 'string' ? sizeMap[size] || 'text-[18px]' : '';
  const customStyle: React.CSSProperties = typeof size === 'number' ? { fontSize: `${size}px`, ...style } : { ...style };
  const colorClass = colorMap[color] || '';
  const fillClass = fill ? 'fill-icon' : '';
  const spinClass = spin ? 'animate-spin' : '';

  return (
    <span
      className={`material-symbols-outlined select-none inline-flex items-center justify-center leading-none ${sizeClass} ${colorClass} ${fillClass} ${spinClass} ${className}`.trim()}
      style={customStyle}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
};

export default Icon;
