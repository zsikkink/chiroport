interface StaticLoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'white' | 'primary' | 'gray';
  className?: string;
  text?: string;
}

/**
 * StaticLoadingSpinner Component (Server-Side Rendered)
 * 
 * A pure CSS loading spinner that works without JavaScript.
 * Perfect for server-side rendering and progressive enhancement.
 */
export default function StaticLoadingSpinner({
  size = 'md',
  color = 'white',
  className = '',
  text
}: StaticLoadingSpinnerProps) {
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
 * Static loading components for common use cases
 */
export function StaticPageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <StaticLoadingSpinner size="lg" text={text} />
    </div>
  );
}

export function StaticInlineLoader({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      {text ? (
        <StaticLoadingSpinner size="md" text={text} />
      ) : (
        <StaticLoadingSpinner size="md" />
      )}
    </div>
  );
} 