import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toLocationSlug } from '@/lib/locationSlug';

export default async function EmployeeRedirectPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('locations')
    .select('airport_code,code')
    .eq('is_open', true)
    .order('airport_code', { ascending: true })
    .order('code', { ascending: true })
    .limit(1);

  const firstLocation = data?.[0];
  if (firstLocation) {
    redirect(
      `/employee/${toLocationSlug(
        firstLocation.airport_code,
        firstLocation.code
      )}`
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <p className="text-sm text-slate-500">No locations are available.</p>
    </div>
  );
}
