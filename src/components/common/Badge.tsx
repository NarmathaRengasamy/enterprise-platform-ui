import React from 'react';
import Icon from './Icon';

export type BadgeVariant = 'primary' | 'secondary' | 'tertiary' | 'outline' | 'neutral' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  primary: {
    container: 'bg-primary/10 text-primary border border-primary/20',
    dot: 'bg-primary'
  },
  secondary: {
    container: 'bg-secondary-fixed/40 text-on-secondary-fixed border border-secondary-fixed/50',
    dot: 'bg-secondary'
  },
  tertiary: {
    container: 'bg-tertiary-fixed/60 text-on-tertiary-fixed border border-tertiary-fixed/70',
    dot: 'bg-tertiary'
  },
  outline: {
    container: 'bg-surface-container-lowest text-on-surface border border-outline-variant/60',
    dot: 'bg-outline'
  },
  neutral: {
    container: 'bg-surface-container text-on-surface-variant border border-surface-container-high',
    dot: 'bg-on-surface-variant'
  },
  error: {
    container: 'bg-error-container text-on-error-container border border-error/20',
    dot: 'bg-error'
  },
  info: {
    container: 'bg-primary-container/15 text-primary-container border border-primary-container/20',
    dot: 'bg-primary-container'
  }
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] gap-1 rounded-md font-medium',
  md: 'px-2.5 py-1 text-xs gap-1.5 rounded-full font-semibold',
  lg: 'px-3 py-1.5 text-sm gap-2 rounded-full font-semibold'
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  dot = false,
  children,
  className = '',
  ...props
}) => {
  const { container, dot: dotColor } = variantStyles[variant] || variantStyles.neutral;
  const sizeClass = sizeStyles[size] || sizeStyles.md;

  return (
    <span
      className={`inline-flex items-center tracking-normal leading-tight select-none ${container} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
      {icon && <Icon name={icon} size="xs" />}
      <span>{children}</span>
    </span>
  );
};

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  status: string;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className = '',
  ...props
}) => {
  const normalized = status?.toLowerCase() || '';

  let variant: BadgeVariant = 'neutral';
  if (normalized.includes('in stock') || normalized.includes('active') || normalized.includes('published') || normalized.includes('healthy') || normalized.includes('online')) {
    variant = 'secondary';
  } else if (normalized.includes('low') || normalized.includes('warning') || normalized.includes('pending') || normalized.includes('review') || normalized.includes('in progress')) {
    variant = 'tertiary';
  } else if (normalized.includes('out of stock') || normalized.includes('error') || normalized.includes('failed') || normalized.includes('rejected') || normalized.includes('inactive')) {
    variant = 'error';
  } else if (
    normalized.includes('unspecified') ||
    normalized.includes('draft') ||
    normalized.includes('archived')
  ) {
    /* Unspecified is deliberately quiet: it is an absence of information, not a
       problem to alarm anyone about. */
    variant = 'outline';
  }

  return (
    <Badge variant={variant} size={size} dot className={className} {...props}>
      {label || status}
    </Badge>
  );
};

export default Badge;
