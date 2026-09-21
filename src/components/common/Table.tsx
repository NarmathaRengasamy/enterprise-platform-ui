import React from 'react';
import Icon from './Icon';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
  className?: string;
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({
  containerClassName = '',
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`w-full overflow-x-auto ${containerClassName}`.trim()}>
      <table className={`w-full text-left border-collapse ${className}`.trim()} {...props}>
        {children}
      </table>
    </div>
  );
};

export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
  children: React.ReactNode;
}

export const TableHead: React.FC<TableHeadProps> = ({ className = '', children, ...props }) => {
  return (
    <thead
      className={`bg-surface-container-low text-on-surface-variant font-caption text-caption uppercase tracking-wider ${className}`.trim()}
      {...props}
    >
      {children}
    </thead>
  );
};

export interface TableHeadCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | false;
  onSort?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const TableHeadCell: React.FC<TableHeadCellProps> = ({
  sortable = false,
  sorted = false,
  onSort,
  className = '',
  children,
  ...props
}) => {
  return (
    <th
      onClick={sortable ? onSort : undefined}
      className={`
        py-3 px-space-md font-semibold
        ${sortable ? 'cursor-pointer select-none hover:text-primary transition-colors' : ''}
        ${className}
      `.trim()}
      {...props}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {sortable && (
          <span className="shrink-0 text-outline">
            {sorted === 'asc' ? (
              <Icon name="arrow_upward" size="xs" color="primary" />
            ) : sorted === 'desc' ? (
              <Icon name="arrow_downward" size="xs" color="primary" />
            ) : (
              <Icon name="unfold_more" size="xs" />
            )}
          </span>
        )}
      </div>
    </th>
  );
};

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
  children: React.ReactNode;
}

export const TableBody: React.FC<TableBodyProps> = ({ className = '', children, ...props }) => {
  return (
    <tbody className={`divide-y divide-surface-container-low/50 ${className}`.trim()} {...props}>
      {children}
    </tbody>
  );
};

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hover?: boolean;
  selected?: boolean;
  clickable?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const TableRow: React.FC<TableRowProps> = ({
  hover = true,
  selected = false,
  clickable = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <tr
      className={`
        transition-colors
        ${hover ? 'hover:bg-surface-container-low/50' : ''}
        ${selected ? 'bg-primary/5' : ''}
        ${clickable ? 'cursor-pointer' : ''}
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </tr>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children?: React.ReactNode;
}

export const TableCell: React.FC<TableCellProps> = ({ className = '', children, ...props }) => {
  return (
    <td className={`py-3 px-space-md font-body-sm text-body-sm text-on-surface ${className}`.trim()} {...props}>
      {children}
    </td>
  );
};

export interface TableEmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  colSpan?: number;
  className?: string;
}

export const TableEmptyState: React.FC<TableEmptyStateProps> = ({
  icon = 'search_off',
  title = 'No records found',
  description = 'Try adjusting your search or filters to find what you are looking for.',
  action,
  colSpan = 10,
  className = ''
}) => {
  return (
    <tr>
      <td colSpan={colSpan} className={`py-12 px-4 text-center ${className}`}>
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-outline mb-3">
            <Icon name={icon} size="xl" />
          </div>
          <h4 className="font-title-sm text-title-sm font-semibold text-on-surface">{title}</h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 mb-4">{description}</p>
          {action}
        </div>
      </td>
    </tr>
  );
};

export default Table;
