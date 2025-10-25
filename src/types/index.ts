/**
 * Central Type Definitions for Chiroport Application
 */

// Location and Airport Types
export interface LocationInfo {
  gate: string;
  landmark: string;
  airportCode: string;
  imageUrl: string;
  customLocation: string;
  customHours: string;
  displayName: string;
  intakeCategory?: 'standard' | 'offers_massage';
}

export interface ConcourseInfo {
  name: string;
  slug: string;
  displayName: string;
  locationInfo: LocationInfo;
}

export interface AirportLocation {
  name: string;
  code: string;
  slug: string;
  concourses: ConcourseInfo[];
}

// Component Props Types
export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'location' | 'back';
  icon?: React.ReactNode | string;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface LocationImageProps {
  src: string;
  alt: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  preserveAspectRatio?: boolean;
}

// Theme and Design System Types
export interface ThemeColors {
  primary: {
    main: string;
    dark: string;
    light: string;
  };
  text: {
    primary: string;
    secondary: string;
    dark: string;
  };
  ui: {
    border: string;
    shadow: string;
    background: string;
  };
}

// Route Parameters
export interface LocationPageParams {
  location: string;
  concourse: string;
}

// Error Types
export interface AppError {
  message: string;
  code?: string;
  details?: string;
}

// Utility Types
export type AirportCode = 'ATL' | 'DFW' | 'HOU' | 'LAS' | 'MSP';
export type ImageFormat = 'webp' | 'jpeg'; 
