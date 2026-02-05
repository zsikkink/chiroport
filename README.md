# Chiroport

Customer-facing and employee-facing web app for managing chiropractic queues in major US airports. Built with Next.js App Router, Supabase, and Twilio.

## Key Features
- **Customer intake + queue join** by location/concourses.
- **Employee dashboard** for queue management and SMS workflows.
- **Multi-airport support** (ATL, DFW, HOU, LAS, MSP) driven by JSON location data.
- **Supabase Realtime** updates for queue entries and SMS inbox/outbox.
- **Twilio SMS** integration for customer communication.

## Tech Stack
- **Next.js** 16.1.6 (App Router)
- **React** 19 + **TypeScript**
- **Tailwind CSS**
- **Supabase** (Postgres, Auth, Realtime, Edge Functions)
- **Twilio** (SMS)
- **Zod** (validation), **Framer Motion** (animations)

## Project Structure
```
src/
├── app/                    # App Router pages + route handlers
├── components/             # Shared UI components
├── content/                # Marketing/service copy
├── data/                   # JSON-backed location data
├── features/               # Feature modules
├── lib/                    # Client helpers (Supabase, location data)
├── schemas/                # Zod schemas
└── server/                 # Server-only helpers (config, env)

supabase/
├── functions/              # Supabase Edge Functions
└── migrations/             # SQL migrations

scripts/                    # Local tooling (smoke tests, cache utils)

tests/                      # Jest tests
```

## Local Development
### Prerequisites
- Node.js **22+**
- npm

### Setup
```bash
npm install
cp env.template .env.local
# Fill in .env.local (see env.template)

npm run dev
# open http://localhost:3000
```

### Supabase Workflow
```bash
# Apply migrations to your Supabase project
supabase db push

# Regenerate Supabase TypeScript types
npm run db:types
```

## Environment Variables
Use `env.template` as the source of truth.

- **Next.js runtime** reads `.env.local` locally and Vercel env vars in prod.
- **Edge Functions** use Supabase secrets (`supabase secrets set`).

## Common Scripts
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run type-check   # TypeScript
npm test             # Jest
npm run db:migrate   # supabase db push
npm run db:types     # supabase gen types
npm run rate-limit:smoke  # Rate-limit smoke test
npm run queue:clear  # Clear queue entries (destructive)
npm run queue:clear:smoke # Smoke test queue:clear guardrails
```

## Locations & Images
- Location data lives in `data/locationData.json`.
- Location images are served from `public/images/stores/`.

## Queue Maintenance (Destructive)
Use `queue:clear` for manual cleanup. It is guarded to prevent accidental production wipes.

Examples:
```bash
# Dry-run a location clear
npm run queue:clear -- --airport-code ATL --location-code concourse-a --dry-run

# Clear a specific queue (non-prod)
npm run queue:clear -- --queue-id <uuid>

# Clear all entries (requires confirmation)
npm run queue:clear -- --all --confirm

# Clear all entries in production (explicit)
npm run queue:clear -- --all --confirm --force-prod
```

## Deployment
- **Frontend**: Vercel
- **Backend**: Supabase (DB + Edge Functions)
- **SMS**: Twilio

## CORS Origin Logging (Audit Mode)
Before enforcing a strict CORS allowlist, this repo logs incoming Origin headers
for Edge Functions in **production/staging only**. See `docs/cors-origin-logging.md`
for log format, where to find logs, and how long to observe.

## License
See `LICENSE`.
