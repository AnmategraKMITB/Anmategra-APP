import * as React from 'react';
import { cn } from '~/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

/**
 * A modified shadcn-ui input component with support for adornments.
 *
 * @param [startAdornment] - Element to display at the start of the input (e.g., an icon).
 * @param [endAdornment] - Element to display at the end of the input (e.g., a button or icon).
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startAdornment, endAdornment, ...props }, ref) => {
    return (
      <div className="relative flex w-full items-center">
        {startAdornment ? (
          <span className="absolute left-0 pl-3 text-sm">{startAdornment}</span>
        ) : null}
        <input
          type={type}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-search-cancel-button]:cursor-pointer',
            Boolean(startAdornment) && 'pl-10',
            Boolean(endAdornment) && 'pr-10',
            className,
          )}
          ref={ref}
          {...props}
        />
        {endAdornment ? (
          <span className="absolute right-0 pr-3 text-sm">{endAdornment}</span>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
