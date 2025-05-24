'use client';

import { ReactNode, ElementType } from 'react';

interface ScalableTextProps {
  children: ReactNode;
  /** Minimum font size in rem */
  minSize?: number;
  /** Preferred font size in rem */
  preferredSize?: number; 
  /** Maximum font size in rem */
  maxSize?: number;
  /** HTML element to render */
  as?: ElementType;
  /** Additional CSS classes */
  className?: string;
  /** Text weight */
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

/**
 * ScalableText Component
 * 
 * A text component optimized for accessibility and text scaling.
 * Uses CSS clamp() to provide smooth scaling within defined bounds.
 * 
 * USAGE EXAMPLES:
 * <ScalableText minSize={1} preferredSize={1.5} maxSize={2.5}>
 *   Large heading that scales gracefully
 * </ScalableText>
 * 
 * <ScalableText as="span" minSize={0.875} preferredSize={1} maxSize={1.25}>
 *   Body text with subtle scaling
 * </ScalableText>
 */
export default function ScalableText({
  children,
  minSize = 1,
  preferredSize = 1.25,
  maxSize = 2,
  as: Component = 'p',
  className = '',
  weight = 'normal'
}: ScalableTextProps) {
  const style = {
    fontSize: `clamp(${minSize}rem, ${preferredSize}rem, ${maxSize}rem)`,
    lineHeight: preferredSize >= 1.5 ? '1.2' : '1.4', // Tighter line height for larger text
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  };

  const weightClass = `font-${weight}`;
  const classes = `${weightClass} ${className}`.trim();

  return (
    <Component 
      style={style}
      className={classes}
    >
      {children}
    </Component>
  );
}

/**
 * Pre-configured scalable text components for common use cases
 */

export function ScalableHeading({ children, className = '', ...props }: Omit<ScalableTextProps, 'as' | 'minSize' | 'preferredSize' | 'maxSize'>) {
  return (
    <ScalableText
      as="h2"
      minSize={1.5}
      preferredSize={2.25}
      maxSize={3}
      weight="semibold"
      className={className}
      {...props}
    >
      {children}
    </ScalableText>
  );
}

export function ScalableSubheading({ children, className = '', ...props }: Omit<ScalableTextProps, 'as' | 'minSize' | 'preferredSize' | 'maxSize'>) {
  return (
    <ScalableText
      as="h3"
      minSize={1.25}
      preferredSize={1.75}
      maxSize={2.25}
      weight="medium"
      className={className}
      {...props}
    >
      {children}
    </ScalableText>
  );
}

export function ScalableBody({ children, className = '', ...props }: Omit<ScalableTextProps, 'as' | 'minSize' | 'preferredSize' | 'maxSize'>) {
  return (
    <ScalableText
      as="p"
      minSize={0.875}
      preferredSize={1}
      maxSize={1.25}
      weight="normal"
      className={className}
      {...props}
    >
      {children}
    </ScalableText>
  );
} 