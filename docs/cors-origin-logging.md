# CORS Origin Logging (Edge Functions)

This repo logs incoming request **Origin** headers in **production** and **staging** to help audit real-world CORS usage before enforcing a strict allowlist.

## Where logs appear
- Supabase Edge Functions logs (Supabase dashboard → Logs → Functions)

## Log format
Each log entry is a JSON line:
```json
{
  "level": "info",
  "event": "cors_origin_observed",
  "origin": "https://example.com",
  "path": "/functions/v1/queue_join",
  "environment": "production",
  "observed_at": "2026-02-05T04:12:34.567Z"
}
```

Notes:
- If the Origin header is missing, `origin` will be `"none"`.
- No tokens, cookies, bodies, or query params are logged.
- Each unique `origin + path + environment` is logged **at most once per hour** per function instance.

## How to extract origins
1. Filter logs for `event = "cors_origin_observed"`.
2. Collect unique `origin` values per `path`.
3. Validate against your intended frontend domains (e.g. `https://thechiroport.com`, `https://www.thechiroport.com`).

## How long to observe
- Minimum: **7 days** of production traffic.
- Ideal: **14–30 days** to capture weekly patterns and any rare clients.

## Verification (manual)
Local (logs should NOT emit):
```bash
supabase functions serve
# Hit a function locally. No cors_origin_observed logs should appear.
```

Production (logs should emit once per hour per origin+path):
- Make a request from your real site.
- Check Supabase Function logs for `cors_origin_observed` entries.

## Enforcement readiness checklist
- [ ] All expected origins observed
- [ ] No unexpected/unknown origins
- [ ] ALLOWED_ORIGINS ready to set in Supabase secrets
