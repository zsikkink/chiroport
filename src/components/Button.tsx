'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/solid';
import { COLORS } from '@/utils/theme';

type ButtonVariant = 'primary' | 'secondary' | 'location' | 'back';
type IconPosition = 'left' | 'right';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: ReactNode | string;
  iconPosition?: IconPosition;
  fullWidth?: boolean;
  className?: string;
}

/**
 * Button Component
 * 
 * A reusable button component with consistent styling across the application.
 * Supports various variants and optional icons.
 */
export default function Button({
  children,
  variant = 'primary',
  icon,
  iconPosition = 'right',
  fullWidth = false,
  className = '',
  ...props
}: ButtonProps) {
  // Base classes for all buttons
  const baseClasses = 'font-lato rounded transition-colors';
  
  // Variant-specific styling
  const variantClasses: Record<ButtonVariant, string> = {
    primary: `bg-[${COLORS.primary.main}] hover:bg-[${COLORS.primary.dark}] text-white py-4 px-8 text-3xl sm:text-4xl md:text-5xl font-bold border-2 border-white shadow-lg`,
    secondary: `bg-white hover:bg-gray-100 text-[${COLORS.primary.main}] py-3 px-6 text-lg font-medium border border-[${COLORS.primary.main}]`,
    location: `bg-[${COLORS.primary.main}] hover:bg-[${COLORS.primary.dark}] text-white py-3 px-6 text-xl sm:text-2xl font-medium shadow-sm border border-white border-opacity-20`,
    back: `bg-[${COLORS.primary.main}] hover:bg-[${COLORS.primary.dark}] text-white py-2 px-4 text-base font-medium`
  };
  
  // Width classes
  const widthClasses = fullWidth ? 'w-full' : '';
  
  // Layout and icon spacing classes
  const getLayoutClasses = () => {
    const base = 'flex items-center';
    switch (iconPosition) {
      case 'left':
        return `${base} flex-row`;
      case 'right':
        return `${base} justify-between`;
      default:
        return base;
    }
  };
  
  // Icon spacing
  const iconSpacing = iconPosition === 'left' ? 'mr-2' : 'ml-4';
  
  // Combine all classes
  const classes = [
    baseClasses,
    variantClasses[variant],
    getLayoutClasses(),
    widthClasses,
    className
  ].filter(Boolean).join(' ');

  // Convert string icons to Heroicon components
  const getIconComponent = () => {
    if (!icon) return null;
    
    if (icon === '→') {
      return <ChevronRightIcon className="w-5 h-5" />;
    } else if (icon === '←') {
      return <ChevronLeftIcon className="w-5 h-5" />;
    }
    
    return icon;
  };
  
  const iconComponent = getIconComponent();

  return (
    <button className={classes} {...props}>
      {iconPosition === 'left' && iconComponent && (
        <span className={iconSpacing}>{iconComponent}</span>
      )}
      {children}
      {iconPosition === 'right' && iconComponent && (
        <span className={iconSpacing}>{iconComponent}</span>
      )}
    </button>
  );
}

/**
 * Specialized button components for common use cases
 */
export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="primary" {...props} />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="secondary" {...props} />;
}

export function LocationButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="location" {...props} />;
}

export function BackButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="back" icon="←" iconPosition="left" {...props} />;
} 