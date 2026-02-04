import type { CSSProperties, ElementType, ReactNode } from 'react';

type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold';
type FontFamily = 'lato' | 'libre-baskerville';
type TextVariant = 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'logo';

type StaticTypographyProps = {
  children: ReactNode;
  variant?: TextVariant;
  size?: TextSize;
  weight?: FontWeight;
  font?: FontFamily;
  color?: string;
  className?: string;
  as?: ElementType;
  style?: CSSProperties;
};

type VariantConfig = {
  size: TextSize;
  weight: FontWeight;
  font: FontFamily;
  element: ElementType;
};

/**
 * StaticTypography Component (Server-Side Rendered)
 * 
 * Server-rendered typography component that provides consistent text styling
 * without requiring client-side JavaScript. Uses CSS-only responsive design.
 */
export default function StaticTypography({
  children,
  variant = 'body',
  size,
  weight,
  font,
  color = 'text-white',
  className = '',
  as,
  style = {},
}: StaticTypographyProps) {
  // Default styling and element mapping based on variant
  const variantConfig: Record<TextVariant, VariantConfig> = {
    title: { size: '4xl', weight: 'bold', font: 'libre-baskerville', element: 'h1' },
    heading: { size: '2xl', weight: 'semibold', font: 'lato', element: 'h2' },
    subheading: { size: 'xl', weight: 'semibold', font: 'lato', element: 'h3' },
    body: { size: 'xl', weight: 'medium', font: 'lato', element: 'p' },
    label: { size: 'sm', weight: 'medium', font: 'lato', element: 'span' },
    logo: { size: '4xl', weight: 'bold', font: 'libre-baskerville', element: 'div' },
  };

  // Get the default styling for the selected variant
  const config = variantConfig[variant];
  
  // Apply variant defaults, but allow props to override
  const textSize = size || config.size;
  const fontWeight = weight || config.weight;
  const fontFamily = font || config.font;
  
  // Use provided element type or default from variant config
  const Component = as || config.element;
  
  // Generate class string with responsive design classes
  const baseClasses = [
    `text-${textSize}`,
    `font-${fontWeight}`,
    `font-${fontFamily}`,
    color,
    'break-words', // CSS-only text wrapping
    'max-w-full',
    className
  ].filter(Boolean).join(' ');

  // CSS-only responsive styles
  const enhancedStyle = {
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
    hyphens: 'auto' as const,
    maxWidth: '100%',
    ...style,
  };

  return (
    <Component 
      className={baseClasses}
      style={enhancedStyle}
    >
      {children}
    </Component>
  );
}

/**
 * Static typography components for common use cases
 */
export function StaticTitle({ children, className = '', style = {}, ...props }: Omit<StaticTypographyProps, 'variant'>) {
  return (
    <StaticTypography 
      variant="title" 
      className={className}
      style={style}
      {...props}
    >
      {children}
    </StaticTypography>
  );
}

export function StaticHeading({ children, className = '', ...props }: Omit<StaticTypographyProps, 'variant'>) {
  return (
    <StaticTypography variant="heading" className={className} {...props}>
      {children}
    </StaticTypography>
  );
}

export function StaticSubHeading({ children, className = '', ...props }: Omit<StaticTypographyProps, 'variant'>) {
  return (
    <StaticTypography variant="subheading" className={className} {...props}>
      {children}
    </StaticTypography>
  );
}

export function StaticBodyText({ children, className = '', ...props }: Omit<StaticTypographyProps, 'variant'>) {
  return (
    <StaticTypography variant="body" className={className} {...props}>
      {children}
    </StaticTypography>
  );
}

export function StaticLabel({ children, className = '', ...props }: Omit<StaticTypographyProps, 'variant'>) {
  return (
    <StaticTypography variant="label" className={className} {...props}>
      {children}
    </StaticTypography>
  );
} 
