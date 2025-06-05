/**
 * Waitwhile Submission API Route
 * 
 * POST /api/waitwhile/submit
 * Creates a customer and visit in Waitwhile based on form submission data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createVisit } from '@/lib/waitwhile-client';
import { debugLog, logError, logSecurityEvent } from '@/utils/config';
import { validateCSRF } from '@/utils/csrf';
import { performSecurityCheck, sanitizeObject } from '@/utils/security';

// Validation schema for form submission (simplified - no serviceId needed)
const submissionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email'),
  birthday: z.string().min(1, 'Birthday is required'),
  discomfort: z.array(z.string()).min(1, 'At least one discomfort area is required'),
  additionalInfo: z.string().optional(),
  consent: z.boolean().refine(val => val === true, 'Consent to treatment is required'),
  selectedTreatment: z.object({
    title: z.string(),
    price: z.string(),
    time: z.string(),
    description: z.string()
  }).nullable(),
  spinalAdjustment: z.boolean().nullable(),
  locationId: z.string().min(1, 'Location ID is required')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Perform comprehensive security checks
    const securityCheck = performSecurityCheck(request, body);
    if (!securityCheck.allowed) {
      logSecurityEvent('security_check_failed', {
        reason: securityCheck.reason,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        endpoint: '/api/waitwhile/submit'
      });
      return NextResponse.json({
        success: false,
        error: 'Security validation failed',
        message: 'Request blocked for security reasons'
      }, { status: 403 });
    }

    // Validate CSRF token for state-changing operations
    if (!validateCSRF(request)) {
      logSecurityEvent('csrf_validation_failed', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        endpoint: '/api/waitwhile/submit'
      });
      return NextResponse.json({
        success: false,
        error: 'CSRF validation failed',
        message: 'Invalid or missing CSRF token. Please refresh the page and try again.'
      }, { status: 403 });
    }

    // Sanitize input data
    const sanitizedBody = sanitizeObject(body);
    debugLog('Received form submission:', sanitizedBody);

    // Check if API key is available
    if (!process.env.WAITWHILE_API_KEY) {
      console.error('WAITWHILE_API_KEY environment variable is missing');
      return NextResponse.json({
        success: false,
        error: 'Server configuration error: API key not found'
      }, { status: 500 });
    }

    // Validate the request body
    const validatedData = submissionSchema.parse(sanitizedBody);

    // Create visit directly using the new Waitwhile API structure
    const visit = await createVisit({
      ...validatedData,
      additionalInfo: validatedData.additionalInfo || ''
    });

    // Return success response with visit information
    return NextResponse.json({
      success: true,
      data: {
        visitId: visit.id,
        queuePosition: visit.queuePosition,
        estimatedWaitTime: visit.estimatedWaitTime,
        message: 'Successfully joined the queue'
      }
    });

  } catch (error: unknown) {
    console.error('API Error:', error);
    logError(error as Error, 'Form submission failed');

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 });
    }

    // Handle Waitwhile API errors
    if (error instanceof Error && error.message.includes('Waitwhile API')) {
      console.error('Waitwhile API Error:', error.message);
      const errorDetails = error.message.includes('details') 
        ? (() => {
            try {
              const detailsStr = error.message.split(': ')[1];
              return detailsStr ? JSON.parse(detailsStr) : null;
            } catch {
              return null;
            }
          })()
        : null;
        
      return NextResponse.json({
        success: false,
        error: error.message || 'Failed to create visit',
        details: errorDetails
      }, { status: 500 });
    }

    // Handle generic errors
    console.error('Generic Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
} 