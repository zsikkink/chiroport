import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { env } from '@/server/env';
import { buildMetabaseEmbedUrl } from '@/server/metabase';

export const runtime = 'nodejs';

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteUrl = env.METABASE_SITE_URL;
  const secret = env.METABASE_EMBED_SECRET;
  const dashboardId = Number.parseInt(env.METABASE_DASHBOARD_ID ?? '', 10);
  const ttlSeconds = Number.parseInt(env.METABASE_EMBED_TTL_SECONDS ?? '600', 10);

  if (!siteUrl || !secret || !Number.isFinite(dashboardId)) {
    return NextResponse.json(
      { error: 'Metabase embed is not configured.' },
      { status: 500 }
    );
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await adminClient
    .from('employee_profiles')
    .select('role,is_open')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: 'Failed to validate access.' }, { status: 500 });
  }

  if (!profile || !profile.is_open || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const embedUrl = buildMetabaseEmbedUrl({
    siteUrl,
    secret,
    dashboardId,
    ttlSeconds: Number.isFinite(ttlSeconds) ? ttlSeconds : 600,
  });

  return NextResponse.json(
    { url: embedUrl },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
