/**
 * Utility functions for formatting text and data
 */

/**
 * Format location and concourse names by capitalizing each word
 */
export function formatName(str: string): string {
  if (typeof str !== 'string') return '';
  
  return str
    .toString()
    .split('-')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
} 