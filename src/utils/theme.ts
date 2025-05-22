/**
 * Theme Configuration
 * 
 * Central location for theme-related constants and values.
 * This helps maintain consistency across the application and
 * makes it easier to update the visual design.
 */

export const COLORS = {
  // Primary colors
  primary: {
    main: '#56655A',
    dark: '#475549',
    light: '#677569',
  },
  
  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: '#F0F0F0',
    dark: '#333333',
  },
  
  // UI element colors
  ui: {
    border: '#FFFFFF',
    shadow: 'rgba(0, 0, 0, 0.1)',
    background: '#FFFFFF',
  }
};

export const FONTS = {
  primary: 'var(--font-lato)',
  secondary: 'var(--font-libre-baskerville)',
};

export const BREAKPOINTS = {
  xs: '375px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export const SPACING = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
};

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
}; 