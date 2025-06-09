/**
 * Treatment and Form Constants
 * 
 * Static data and enums extracted from LocationDetails component
 */

// Treatment options available at The Chiroport
export const TREATMENTS = [
  { title: 'Body on the Go', price: '$69', time: '10 min', description: 'Full spinal and neck adjustment' },
  { title: 'Total Wellness', price: '$99', time: '20 min', description: 'Our signature service—trigger point muscle therapy, full-body stretch, and complete spinal & neck adjustments' },
  { title: 'Sciatica & Lower Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve sciatica and lower back discomfort' },
  { title: 'Neck & Upper Back Targeted Therapy', price: '$119', time: '20 min', description: 'Focused spinal adjustments and muscle work to relieve neck and upper back discomfort' },
  { title: 'Trigger Point Muscle Therapy & Stretch', price: '$89', time: '20 min', description: 'Relieve postural muscle tightness from travel, enhance blood flow, and calm your nervous system' },
  { title: 'Chiro Massage', price: '$79', time: '20 min', description: 'Thai-inspired massage blending trigger-point muscle therapy, dynamic stretching, and mechanical massagers' },
  { title: 'Chiro Massage Mini', price: '$39', time: '10 min', description: 'Thai-inspired massage blending trigger-point muscle therapy and mechanical massagers' },
  { title: 'Undecided', price: '', time: '', description: 'Not sure which therapy is right? Discuss your needs with our chiropractor to choose the best treatment' }
] as const;

// Discomfort options for patient intake form
export const DISCOMFORT_OPTIONS = [
  'Neck Tension or Stiffness',
  'Headache',
  'Upper Back Tightness',
  'Lower Back Tightness',
  'Sciatica',
  'General Soreness',
  'No discomfort'
] as const;

// Derived types
export type DiscomfortOption = (typeof DISCOMFORT_OPTIONS)[number];

// Form validation constants
export const VALIDATION_MESSAGES = {
  NAME_REQUIRED: 'Name is required',
  PHONE_REQUIRED: 'Phone is required',
  PHONE_INVALID: 'Invalid phone number',
  EMAIL_INVALID: 'Invalid email',
  BIRTHDAY_REQUIRED: 'Birthday is required',
  BIRTHDAY_INVALID: 'Invalid date format (MM/DD/YYYY)',
  DISCOMFORT_REQUIRED: 'Please select at least one option',
  CONSENT_REQUIRED: 'You must consent to treatment to proceed'
} as const;

// Date validation constants
export const DATE_VALIDATION = {
  MIN_YEAR: 1900,
  MAX_YEAR: new Date().getFullYear(),
  DATE_REGEX: /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/
} as const; 