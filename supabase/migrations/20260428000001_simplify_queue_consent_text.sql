begin;

insert into public.consent_versions (key, version, text, privacy_policy_url, terms_url, is_active)
values
  (
    'queue_join_consent_bodywork',
    '2026-04-28_v2',
    'I agree to the Privacy Policy and Terms & Conditions.',
    '/privacy-policy',
    '/terms-and-conditions',
    true
  ),
  (
    'queue_join_consent_chiropractic',
    '2026-04-28_v2',
    'I agree to the Privacy Policy and Terms & Conditions.',
    '/privacy-policy',
    '/terms-and-conditions',
    true
  )
on conflict (key)
do update set
  version = excluded.version,
  text = excluded.text,
  privacy_policy_url = excluded.privacy_policy_url,
  terms_url = excluded.terms_url,
  is_active = excluded.is_active;

commit;
