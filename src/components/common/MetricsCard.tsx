import React from 'react';
import Icon from './Icon';

export type MetricVariant = 'primary' | 'secondary' | 'tertiary' | 'neutral';

export interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'warning' | 'neutral';
  trendIcon?: string;
  icon?: string | React.ReactNode;
  variant?: MetricVariant;
  onClick?: () => void;
  className?: string;
  action?: React.ReactNode;
}

const variantStyles: Record<MetricVariant, { iconBg: string; textClass: string }> = {
  primary: {
    iconBg: 'bg-primary/10 text-primary',
    textClass: 'text-primary'
  },
  secondary: {
    iconBg: 'bg-secondary-fixed/30 text-secondary',
    textClass: 'text-secondary'
  },
  tertiary: {
    iconBg: 'bg-tertiary-fixed/30 text-tertiary',
    textClass: 'text-tertiary'
  },
  neutral: {
    iconBg: 'bg-surface-container-high text-on-surface-variant',
    textClass: 'text-on-surface-variant'
  }
};

const trendColorMap = {
  positive: 'text-secondary',
  negative: 'text-error',
  warning: 'text-tertiary',
  neutral: 'text-on-surface-variant'
};

const defaultTrendIconMap = {
  positive: 'trending_up',
  negative: 'trending_down',
  warning: 'priority_high',
  neutral: 'info'
};

export const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendType = 'neutral',
  trendIcon,
  icon,
  variant = 'primary',
  onClick,
  className = '',
  action
}) => {
  const { iconBg } = variantStyles[variant] || variantStyles.primary;
  const isClickable = !!onClick;
  const computedTrendIcon = trendIcon || defaultTrendIconMap[trendType];

  return (
    <div
      onClick={onClick}
      className={`
        bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-low/60
        flex items-center justify-between gap-space-md transition-all duration-200
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-primary/20 active:scale-[0.99]' : ''}
        ${className}
      `.trim()}
    >
      <div className="flex flex-col min-w-0">
        <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider truncate">
          {title}
        </span>
        <span className="font-headline-md text-headline-md text-on-surface font-bold mt-1 tracking-tight">
          {value}
        </span>

        {trend && (
          <span className={`font-label-sm text-label-sm ${trendColorMap[trendType]} flex items-center gap-0.5 mt-0.5 font-medium truncate`}>
            {computedTrendIcon && <Icon name={computedTrendIcon} size="xs" />}
            <span>{trend}</span>
          </span>
        )}

        {!trend && subtitle && (
          <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-0.5 mt-0.5 font-medium truncate">
            {subtitle}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {action}
        {icon && (
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            {typeof icon === 'string' ? <Icon name={icon} size="lg" /> : icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsCard;
