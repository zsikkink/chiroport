'use client';

import { ReactNode, ElementType } from 'react';
import { FONTS } from '@/utils/theme';

type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold';
type FontFamily = 'lato' | 'libre-baskerville';
type TextVariant = 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'logo';

type TypographyProps = {
  children: ReactNode;
  variant?: TextVariant;
  size?: TextSize;
  weight?: FontWeight;
  font?: FontFamily;
  color?: string;
  className?: string;
  as?: ElementType;
  style?: React.CSSProperties;
};

type VariantConfig = {
  size: TextSize;
  weight: FontWeight;
  font: FontFamily;
  element: ElementType;
};

/**
 * Typography Component
 * 
 * A reusable component for consistent text styling across the application.
 * Supports various text variants, sizes, weights, and fonts.
 * Enhanced with text cutoff prevention for mobile devices.
 */
export default function Typography({
  children,
  variant = 'body',
  size,
  weight,
  font,
  color = 'text-white',
  className = '',
  as,
  style = {},
}: TypographyProps) {
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
  
  // Generate class string with non-empty values only + text cutoff prevention
  const baseClasses = [
    `text-${textSize}`,
    `font-${fontWeight}`,
    `font-${fontFamily}`,
    color,
    'mobile-text-safe', // Apply mobile text protection to all typography
    className
  ].filter(Boolean).join(' ');

  // Enhanced inline styles that prevent text cutoff
  const enhancedStyle = {
    wordWrap: 'break-word' as const,
    overflowWrap: 'anywhere' as const,
    wordBreak: 'break-word' as const,
    hyphens: 'auto' as const,
    maxWidth: '100%',
    width: '100%',
    ...style, // Allow custom styles to override
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
 * Specialized typography components for common use cases
 * All enhanced with text cutoff prevention
 */
export function Title({ children, className = '', style = {}, ...props }: Omit<TypographyProps, 'variant'>) {
  const titleStyle = {
    // Extra protection for title text which is most likely to have cutoff issues
    overflow: 'visible',
    textOverflow: 'clip',
    whiteSpace: 'normal' as const,
    ...style,
  };

  return (
    <Typography 
      variant="title" 
      className={`no-text-cutoff ${className}`}
      style={titleStyle}
      {...props}
    >
      {children}
    </Typography>
  );
}

export function Heading({ children, className = '', ...props }: Omit<TypographyProps, 'variant'>) {
  return (
    <Typography variant="heading" className={`no-text-cutoff ${className}`} {...props}>
      {children}
    </Typography>
  );
}

export function SubHeading({ children, className = '', ...props }: Omit<TypographyProps, 'variant'>) {
  return (
    <Typography variant="subheading" className={`no-text-cutoff ${className}`} {...props}>
      {children}
    </Typography>
  );
}

export function BodyText({ children, className = '', ...props }: Omit<TypographyProps, 'variant'>) {
  return (
    <Typography variant="body" className={className} {...props}>
      {children}
    </Typography>
  );
}

export function Label({ children, className = '', ...props }: Omit<TypographyProps, 'variant'>) {
  return (
    <Typography variant="label" className={className} {...props}>
      {children}
    </Typography>
  );
} 