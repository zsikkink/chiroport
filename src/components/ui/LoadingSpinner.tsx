'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'white' | 'primary' | 'gray';
  className?: string;
  text?: string;
}

/**
 * LoadingSpinner Component
 * 
 * A reusable loading spinner with customizable size, color, and optional text.
 * Accessible and follows design system patterns.
 */
export default function LoadingSpinner({
  size = 'md',
  color = 'primary',
  className = '',
  text
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const colorClasses = {
    white: 'text-white',
    primary: 'text-primary',
    gray: 'text-gray-500'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
        role="status"
        aria-label={text || "Loading"}
      >
        <svg
          className="w-full h-full"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      {text && (
        <p className={`mt-2 ${textSizeClasses[size]} ${colorClasses[color]} text-center`}>
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * Specialized loading components for common use cases
 */
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <LoadingSpinner size="lg" text={text} color="primary" />
    </div>
  );
}

export function InlineLoader({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      {text ? (
        <LoadingSpinner size="md" text={text} />
      ) : (
        <LoadingSpinner size="md" />
      )}
    </div>
  );
}

export function ButtonLoader() {
  return <LoadingSpinner size="sm" className="mr-2" />;
}

export const LoadingSpinnerWithText = ({ text }: { text?: string }) => {
  return (
    <div className="text-center">
      {text ? (
        <LoadingSpinner size="md" text={text} />
      ) : (
        <LoadingSpinner size="md" />
      )}
    </div>
  );
}; 
