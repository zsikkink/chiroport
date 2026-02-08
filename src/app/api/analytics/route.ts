import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type CustomerTypeFilter = 'paying' | 'priority_pass' | null;

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function normalizeCustomerType(input: string | null): CustomerTypeFilter {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (normalized === 'paying') return 'paying';
  if (normalized === 'priority_pass' || normalized === 'non_paying') {
    return 'priority_pass';
  }
  return null;
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await adminClient
    .from('employee_profiles')
    .select('role,is_open')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: 'Failed to validate access.' }, { status: 500 });
  }

  if (!profile || !profile.is_open || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const locationIdParam = searchParams.get('locationId');
  const customerTypeParam = searchParams.get('customerType');
  const dateStartParam = searchParams.get('dateStart');
  const dateEndParam = searchParams.get('dateEnd');

  const hasDateRange = Boolean(dateStartParam && dateEndParam);
  const locationId =
    locationIdParam && locationIdParam !== 'all' ? locationIdParam : null;
  const customerType = normalizeCustomerType(customerTypeParam);
  const dateStart = hasDateRange ? dateStartParam : null;
  const dateEnd = hasDateRange ? dateEndParam : null;

  const { data: analytics, error: analyticsError } = await adminClient.rpc(
    'get_admin_analytics',
    {
      p_location_id: locationId,
      p_date_start: dateStart,
      p_date_end: dateEnd,
      p_customer_type: customerType,
    }
  );

  if (analyticsError) {
    return NextResponse.json(
      { error: 'Failed to load analytics.' },
      { status: 500 }
    );
  }

  return NextResponse.json(analytics, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
