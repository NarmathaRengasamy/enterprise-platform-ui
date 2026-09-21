import React from 'react';
import Icon from './Icon';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: 'py-1.5 pl-8 pr-7 text-xs',
  md: 'py-2 pl-9 pr-8 text-body-sm font-body-sm',
  lg: 'py-2.5 pl-10 pr-9 text-base'
};

const iconSizes = {
  sm: 'xs' as const,
  md: 'sm' as const,
  lg: 'md' as const
};

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      // Dispatch synthetic event if no custom onClear provided
      const syntheticEvent = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  return (
    <div className={`relative ${fullWidth ? 'w-full' : 'w-full sm:w-80'} ${className}`.trim()}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none flex items-center">
        <Icon name="search" size={iconSizes[size]} />
      </span>

      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`
          w-full bg-surface rounded-xl text-on-surface placeholder:text-outline
          focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20
          transition-all duration-150
          ${sizeStyles[size]}
        `.trim()}
        {...props}
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          aria-label="Clear search"
        >
          <Icon name="close" size="xs" />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
