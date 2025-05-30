/**
 * Waitwhile Visit Status API Route
 * 
 * GET /api/waitwhile/visit/[visitId]
 * Retrieves the current status of a visit in Waitwhile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVisit } from '@/lib/waitwhile-client';
import { debugLog, logError } from '@/utils/config';

export async function GET(
  request: NextRequest,
  { params }: { params: { visitId: string } }
) {
  try {
    const { visitId } = params;

    if (!visitId) {
      return NextResponse.json(
        { error: 'Visit ID is required' },
        { status: 400 }
      );
    }

    debugLog('Fetching visit status:', { visitId });

    // Get visit from Waitwhile
    const visit = await getVisit(visitId);

    debugLog('Visit status retrieved:', {
      visitId,
      status: visit.status,
      queuePosition: visit.queuePosition
    });

    // Return visit status
    return NextResponse.json({
      success: true,
      data: {
        id: visit.id,
        status: visit.status,
        queuePosition: visit.queuePosition,
        estimatedWaitTime: visit.estimatedWaitTime,
        waitTime: visit.waitTime,
        serviceName: visit.serviceName,
        createdAt: visit.createdAt,
        updatedAt: visit.updatedAt
      }
    });

  } catch (error) {
    logError(error as Error, `Failed to get visit status for ${params.visitId}`);

    // Handle different types of errors
    if (error && typeof error === 'object' && 'error' in error) {
      // Waitwhile API error
      const waitwhileError = error as any;
      
      // Handle 404 specifically
      if (waitwhileError.error.code === '404') {
        return NextResponse.json(
          { 
            error: 'Visit not found',
            message: 'The requested visit could not be found.'
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { 
          error: 'Waitwhile API error',
          message: waitwhileError.error.message,
          code: waitwhileError.error.code
        },
        { status: 500 }
      );
    }

    // Generic error
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve visit status. Please try again.'
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
} 