/**
 * Date Validation
 * 
 * Utilities for validating dates in MM/DD/YYYY format
 */

import { DATE_VALIDATION } from '@/constants/treatments';

/**
 * Validates a date string in MM/DD/YYYY format
 */
export const validateBirthday = (date: string): boolean => {
  if (!date) return false;
  
  // Check format with regex
  if (!DATE_VALIDATION.DATE_REGEX.test(date)) return false;
  
  const parts = date.split('/').map(Number);
  const [month, day, year] = parts;
  
  // Check if all parts are valid numbers
  if (month === undefined || day === undefined || year === undefined) return false;
  
  const dateObj = new Date(year, month - 1, day);
  
  // Check if the date is valid and matches the input
  return dateObj.getFullYear() === year && 
         dateObj.getMonth() === month - 1 && 
         dateObj.getDate() === day &&
         year >= DATE_VALIDATION.MIN_YEAR && 
         year <= DATE_VALIDATION.MAX_YEAR;
}; 