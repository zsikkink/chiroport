/**
 * CSRF Token API Route
 * 
 * GET /api/csrf-token
 * Provides CSRF tokens for client-side forms and AJAX requests.
 */

import { NextResponse } from 'next/server';
import { generateCSRFResponse } from '@/utils/csrf';

export async function GET() {
  try {
    const { token, cookie } = generateCSRFResponse();

    const response = NextResponse.json({
      success: true,
      token,
      message: 'CSRF token generated successfully'
    });

    // Set the CSRF cookie
    response.headers.set('Set-Cookie', cookie);

    return response;
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate CSRF token'
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