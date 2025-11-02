/**
 * Waitwhile Submission API Route
 * 
 * POST /api/waitwhile/submit
 * Creates a customer and visit in Waitwhile based on form submission data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createVisit } from '@/lib/waitwhile-client';
import { FormSubmissionData } from '@/types/waitwhile';
import { debugLog, logError, logSecurityEvent } from '@/utils/config';
import { validateCSRF } from '@/utils/csrf';
import { performSecurityCheck, sanitizeFormData } from '@/utils/security';
import { submissionSchema } from '@/schemas/intake';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Perform comprehensive security checks
    const securityCheck = performSecurityCheck(request);
    if (!securityCheck.allowed) {
      logSecurityEvent('security_check_failed', {
        reason: securityCheck.reason,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        endpoint: '/api/waitwhile/submit'
      });
      
      // CUSTOMER-FRIENDLY: Provide helpful error messages
      let userMessage = 'Request blocked for security reasons';
      if (securityCheck.reason?.includes('user agent')) {
        userMessage = 'Please make sure you are using a standard web browser to access this form';
      } else if (securityCheck.reason?.includes('origin')) {
        userMessage = 'Please make sure you are accessing this form directly from our website';
      } else if (securityCheck.reason?.includes('content')) {
        userMessage = 'Please check your form submission for any unusual characters and try again';
      }
      
      return NextResponse.json({
        success: false,
        error: 'Security validation failed',
        message: userMessage,
        code: 'SECURITY_CHECK_FAILED'
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
        message: 'Security token expired or missing. Please refresh the page and try again.',
        code: 'CSRF_FAILED',
        action: 'refresh_page'
      }, { status: 403 });
    }

    // Sanitize input data using form-specific sanitization
    const sanitizedBody = sanitizeFormData(body);
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

    const visitPayload: FormSubmissionData = {
      name: validatedData.name,
      phone: validatedData.phone,
      discomfort: validatedData.discomfort,
      consent: validatedData.consent,
      selectedTreatment: validatedData.selectedTreatment,
      spinalAdjustment: validatedData.spinalAdjustment,
      locationId: validatedData.locationId,
    };

    if (validatedData.email) {
      visitPayload.email = validatedData.email;
    }

    if (validatedData.birthday) {
      visitPayload.birthday = validatedData.birthday;
    }

    if (validatedData.additionalInfo) {
      visitPayload.additionalInfo = validatedData.additionalInfo;
    }

    // Create visit directly using the new Waitwhile API structure
    const visit = await createVisit(visitPayload);

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
    if (error instanceof ZodError) {
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
