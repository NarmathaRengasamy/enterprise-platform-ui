import React from 'react';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  hover?: boolean;
  bordered?: boolean;
  className?: string;
  children: React.ReactNode;
}

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-space-md',
  lg: 'p-space-lg'
};

export const Card: React.FC<CardProps> = ({
  padding = 'md',
  hover = false,
  bordered = true,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`
        bg-surface-container-lowest rounded-xl shadow-sm
        ${bordered ? 'border border-surface-container-low/60' : ''}
        ${hover ? 'hover:shadow-md hover:border-surface-container-high transition-all duration-200' : ''}
        ${paddingStyles[padding]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm mb-space-sm border-b border-surface-container-low ${className}`.trim()}
      {...props}
    >
      {children ? (
        children
      ) : (
        <>
          <div className="flex flex-col">
            {title && (
              <h3 className="font-title-md text-title-md text-on-surface font-semibold tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex items-center gap-space-xs shrink-0">{action}</div>}
        </>
      )}
    </div>
  );
};

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export const CardBody: React.FC<CardBodyProps> = ({ className = '', children, ...props }) => {
  return (
    <div className={`w-full ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export const CardFooter: React.FC<CardFooterProps> = ({ className = '', children, ...props }) => {
  return (
    <div
      className={`pt-space-sm mt-space-sm border-t border-surface-container-low flex items-center justify-between gap-space-sm ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
