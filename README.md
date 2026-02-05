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
```

## Locations & Images
- Location data lives in `data/locationData.json`.
- Location images are served from `public/images/stores/`.

## Deployment
- **Frontend**: Vercel
- **Backend**: Supabase (DB + Edge Functions)
- **SMS**: Twilio

## License
See `LICENSE`.
