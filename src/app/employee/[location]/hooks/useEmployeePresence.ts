import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { EmployeeProfile, LocationOption } from '../types';
import { formatSupabaseError } from '../utils';

const supabase = getSupabaseBrowserClient();

type UseEmployeePresenceOptions = {
  onActionError?: (message: string) => void;
};

export function useEmployeePresence(options: UseEmployeePresenceOptions = {}) {
  const { onActionError } = options;
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const currentUser = session?.user ?? null;

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select('role,is_open')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      const message = formatSupabaseError(error, 'Failed to load profile.');
      console.error('[employee] loadProfile failed', { error, userId });
      setAuthError(message);
      setProfile(null);
      return;
    }

    if (!data || !data.is_open) {
      setAccessDenied(true);
      setProfile(null);
      return;
    }

    setAccessDenied(false);
    setProfile({ role: data.role, is_open: data.is_open });
  }, []);

  const loadLocations = useCallback(async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id,display_name,airport_code,code')
      .eq('is_open', true)
      .order('airport_code', { ascending: true })
      .order('code', { ascending: true });

    if (error) {
      const message = formatSupabaseError(error, 'Failed to load locations.');
      console.error('[employee] loadLocations failed', { error });
      onActionError?.(message);
      return;
    }

    setLocations(data ?? []);
  }, [onActionError]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      supabase.functions.setAuth(session.access_token);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      return;
    }
    loadProfile(currentUser.id);
  }, [currentUser, loadProfile]);

  useEffect(() => {
    if (profile) {
      loadLocations();
    }
  }, [profile, loadLocations]);

  const handleSignIn = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  return {
    session,
    currentUser,
    authLoading,
    authError,
    profile,
    accessDenied,
    locations,
    handleSignIn,
    handleSignOut,
  };
}
