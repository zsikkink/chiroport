import { createAuthedClient, createServiceRoleClient } from './supabaseClient.ts';

export type EmployeeRole = 'employee' | 'admin';

export type EmployeeAuthContext = {
  authed: ReturnType<typeof createAuthedClient>;
  service: ReturnType<typeof createServiceRoleClient>;
  userId: string;
  role: EmployeeRole;
};

export async function requireEmployee(authHeader: string): Promise<EmployeeAuthContext> {
  const authed = createAuthedClient(authHeader);
  const service = createServiceRoleClient();

  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await service
    .from('employee_profiles')
    .select('role,is_open')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile?.is_open ||
    !['employee', 'admin'].includes(profile.role)
  ) {
    throw new Error('Unauthorized');
  }

  return {
    authed,
    service,
    userId: userData.user.id,
    role: profile.role,
  };
}
