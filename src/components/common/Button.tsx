import React from 'react';
import Icon from './Icon';

export type ButtonVariant =
  | 'primary'
  | 'solid'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'transparent'
  | 'hover'
  | 'soft'
  | 'tonal'
  | 'danger';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon' | 'icon-lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  startIcon?: string | React.ReactNode;
  endIcon?: string | React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  active?: boolean;
  children?: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm active:scale-[0.98] border border-transparent',
  solid: 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm active:scale-[0.98] border border-transparent',
  secondary: 'bg-surface-container text-on-surface hover:bg-surface-container-high active:scale-[0.98] border border-transparent',
  outline: 'border border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low active:scale-[0.98] shadow-xs',
  ghost: 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-[0.98]',
  transparent: 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-[0.98]',
  hover: 'bg-surface text-on-surface hover:bg-surface-container-high hover:shadow-md transition-all active:scale-[0.98] border border-surface-container-high/60',
  soft: 'bg-primary/10 text-primary hover:bg-primary/15 active:scale-[0.98] border border-primary/10 font-semibold',
  tonal: 'bg-primary/10 text-primary hover:bg-primary/15 active:scale-[0.98] border border-primary/10 font-semibold',
  danger: 'bg-error text-on-error hover:bg-error/90 shadow-sm active:scale-[0.98] border border-transparent'
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs rounded-md gap-1',
  sm: 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5 font-medium',
  md: 'px-3.5 py-2 text-sm rounded-xl gap-2 font-medium',
  lg: 'px-4.5 py-2.5 text-base rounded-xl gap-2.5 font-semibold',
  'icon-sm': 'p-1.5 rounded-lg text-sm aspect-square flex items-center justify-center',
  icon: 'p-2 rounded-xl text-base aspect-square flex items-center justify-center',
  'icon-lg': 'p-2.5 rounded-xl text-lg aspect-square flex items-center justify-center'
};

const iconSizeMap: Record<ButtonSize, 'xs' | 'sm' | 'md' | 'lg'> = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  'icon-sm': 'sm',
  icon: 'md',
  'icon-lg': 'lg'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      startIcon,
      endIcon,
      loading = false,
      fullWidth = false,
      active = false,
      disabled = false,
      className = '',
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isIconOnly = size.startsWith('icon');
    const computedVariantClass = variantClasses[variant] || variantClasses.primary;
    const computedSizeClass = sizeClasses[size] || sizeClasses.md;
    const defaultIconSize = iconSizeMap[size] || 'md';

    const renderIcon = (iconItem: string | React.ReactNode) => {
      if (!iconItem) return null;
      if (typeof iconItem === 'string') {
        return <Icon name={iconItem} size={defaultIconSize} />;
      }
      return iconItem;
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center
          transition-all duration-150 select-none cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
          disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100
          ${fullWidth ? 'w-full' : ''}
          ${computedVariantClass}
          ${computedSizeClass}
          ${active ? 'ring-2 ring-primary/30 shadow-xs' : ''}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      >
        {loading ? (
          <Icon name="progress_activity" spin size={defaultIconSize} className="shrink-0" />
        ) : (
          startIcon && <span className="shrink-0 inline-flex items-center">{renderIcon(startIcon)}</span>
        )}

        {children && <span className={isIconOnly ? 'sr-only' : ''}>{children}</span>}

        {!loading && endIcon && (
          <span className="shrink-0 inline-flex items-center">{renderIcon(endIcon)}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
