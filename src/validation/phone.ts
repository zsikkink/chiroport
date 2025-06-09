/**
 * Phone Number Validation
 * 
 * Utilities for validating phone numbers with support for US and international formats
 */

import { isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Custom phone validation that handles US numbers properly
 */
export const validatePhoneNumber = (phone: string): boolean => {
  if (!phone) return false;
  
  // If it starts with +, it's international - validate as-is
  if (phone.startsWith('+')) {
    return isValidPhoneNumber(phone);
  }
  
  // For US numbers (just digits), add +1 country code for validation
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return isValidPhoneNumber(`+1${digitsOnly}`);
  }
  
  return false;
}; 