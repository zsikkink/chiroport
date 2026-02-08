'use client';

import { ReactNode, ButtonHTMLAttributes, forwardRef, CSSProperties } from 'react';
import { ChevronRightIcon, ChevronLeftIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

type ButtonVariant = 'primary' | 'secondary' | 'location' | 'back';
type IconPosition = 'left' | 'right';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: ReactNode | string;
  iconPosition?: IconPosition;
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Button Component
 * 
 * A reusable, accessible button component with consistent styling across the application.
 * - Supports dynamic styling via style prop
 * - Uses fluid text sizing for accessibility when no style override
 * - Supports various variants and optional icons
 * - Maintains proper spacing and layout at all text sizes
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  icon,
  iconPosition = 'right',
  fullWidth = false,
  className = '',
  style,
  ...props
}, ref) => {
  // Base classes for all buttons with accessibility features
  const baseClasses = `
    font-lato rounded
    transition-[transform,box-shadow,background-color,color,border-color] duration-200
    enabled:hover:-translate-y-px enabled:active:translate-y-0
    overflow-hidden
    flex items-center
  `;
  
  // Variant-specific styling - only used when no style override
  const variantClasses: Record<ButtonVariant, string> = {
    primary: `
      bg-[var(--color-header)] hover:bg-[var(--color-primary-dark)] text-white 
      py-3 px-4 
      font-bold border border-[color:var(--color-body)] shadow-sm
      min-h-[3rem]
    `,
    secondary: `
      bg-[var(--color-header)] hover:bg-[var(--color-primary-dark)] text-white 
      py-2 px-4 
      font-medium border border-[color:var(--color-body)]
      min-h-[2.5rem]
    `,
    location: `
      bg-[var(--color-header)] hover:bg-[var(--color-primary-dark)] text-white 
      py-2 px-4 
      font-medium shadow-sm border border-[color:var(--color-body)]
      min-h-[2.5rem]
    `,
    back: `
      bg-[var(--color-header)] hover:bg-[var(--color-primary-dark)] text-white 
      py-2 px-3 
      font-medium
      border border-[color:var(--color-body)]
      min-h-[2rem]
    `
  };
  
  // Width classes with overflow protection
  const widthClasses = fullWidth ? 'w-full' : '';
  
  // Layout classes based on icon position
  const getLayoutClasses = () => {
    switch (iconPosition) {
      case 'left':
        return 'justify-start';
      case 'right':
        return 'justify-between';
      default:
        return 'justify-center';
    }
  };
  
  // Icon spacing with responsive design
  const iconSpacing = iconPosition === 'left' ? 'mr-2' : 'ml-2';
  
  // Combine classes - skip variant classes if style is provided
  const classes = [
    baseClasses,
    !style ? variantClasses[variant] : '', // Only use variant classes if no style override
    getLayoutClasses(),
    widthClasses,
    className
  ].filter(Boolean).join(' ');

  // Convert string icons to Heroicon components with responsive sizing
  const getIconComponent = () => {
    if (!icon) return null;
    
    const iconClasses = "w-4 h-4 flex-shrink-0";
    
    if (icon === '→') {
      return <ChevronRightIcon className={iconClasses} />;
    } else if (icon === '←') {
      return <ChevronLeftIcon className={iconClasses} />;
    } else if (icon === '↓') {
      return <ChevronDownIcon className={iconClasses} />;
    }
    
    return icon;
  };
  
  const iconComponent = getIconComponent();

  return (
    <button ref={ref} className={classes} style={style} {...props}>
      {iconPosition === 'left' && iconComponent && (
        <span className={iconSpacing}>{iconComponent}</span>
      )}
      <span className="
        flex-1 
        overflow-hidden
        whitespace-nowrap
        text-ellipsis
        text-center
      ">
        {children}
      </span>
      {iconPosition === 'right' && iconComponent && (
        <span className={iconSpacing}>{iconComponent}</span>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;

/**
 * Specialized button components for common use cases
 */
export const PrimaryButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>((props, ref) => {
  return <Button ref={ref} variant="primary" {...props} />;
});

PrimaryButton.displayName = 'PrimaryButton';

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="secondary" {...props} />;
}

export function LocationButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="location" {...props} />;
}

export function BackButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="back" icon="←" iconPosition="left" {...props} />;
} 
