import React from 'react';
import Button from './Button';
import { Icon } from './Icon';

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading…',
  className = ''
}) => (
  <div className={`w-full flex flex-col items-center justify-center py-space-xl gap-2 ${className}`}>
    <Icon name="progress_activity" spin size="xl" color="primary" />
    <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
  </div>
);

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, className = '' }) => (
  <div
    role="alert"
    className={`w-full flex flex-col items-center justify-center py-space-xl gap-2 text-center ${className}`}
  >
    <div className="w-11 h-11 rounded-xl bg-error-container/40 text-error flex items-center justify-center">
      <Icon name="cloud_off" size="xl" color="error" />
    </div>
    <span className="font-title-sm text-title-sm text-on-surface font-semibold">
      Couldn&apos;t load this data
    </span>
    <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">{message}</p>
    {onRetry && (
      <Button variant="hover" size="sm" startIcon="refresh" onClick={onRetry} className="mt-1">
        Try again
      </Button>
    )}
  </div>
);

/* Thin inline banner for pages that should keep rendering their chrome while a
   background refresh fails. */
export const ErrorBanner: React.FC<ErrorStateProps> = ({ message, onRetry, className = '' }) => (
  <div
    role="alert"
    className={`flex items-center justify-between gap-3 px-space-md py-2.5 rounded-xl bg-error-container/40 border border-error/20 ${className}`}
  >
    <div className="flex items-center gap-2 min-w-0">
      <Icon name="error" size="sm" color="error" />
      <span className="font-body-sm text-body-sm text-on-error-container truncate">{message}</span>
    </div>
    {onRetry && (
      <Button variant="ghost" size="sm" startIcon="refresh" onClick={onRetry}>
        Retry
      </Button>
    )}
  </div>
);

export default LoadingState;
