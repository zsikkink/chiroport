import { LocationsWrapper } from '@/features/locations';
import { airportLocations } from '@/lib';
import { ChevronRightIcon } from '@heroicons/react/24/solid';
import StaticFeatureCards from './StaticFeatureCards';

/**
 * DynamicHomeContent Component
 * 
 * Home page content wrapper that coordinates:
 * - Hero title and CTA
 * - Queue entry control
 * - Feature cards layout
 *
 * Uses CSS-first responsive sizing to avoid hydration reflow/flicker.
 */
export default function DynamicHomeContent() {
  const queueHighlightsText = 'Walk-ins welcome, No account required, Live text updates';

  const normalizeDirections = (text: string) => {
    const stripped = text.replace(/^located\b[\s,:-]*/i, '').trim();
    if (!stripped) return text;
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
  };

  const storeDetails = airportLocations.flatMap((airport) =>
    airport.concourses.map((concourse) => ({
      id: `${airport.code}-${concourse.slug}`,
      label: `${airport.code} · ${concourse.displayName}`,
      directions: normalizeDirections(concourse.locationInfo.customLocation),
      hours: concourse.locationInfo.customHours,
    }))
  );

  return (
    <main 
      className="relative -mt-2 sm:mt-0 flex min-h-screen flex-col items-center overflow-x-hidden pt-3 sm:pt-9 pb-12"
      style={{
        paddingLeft: 'max(16px, 5vw)',
        paddingRight: 'max(16px, 5vw)'
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(86,101,90,0.14),transparent_60%)]"
      />
      {/* Hero section with dynamic title */}
      <div className="mx-auto w-full max-w-[760px] text-center mb-4 sm:mb-5">
        <h1 
          className="
            font-bold text-black 
            w-full
            whitespace-nowrap
            leading-[0.95]
            tracking-tight
            px-0
            max-w-full
            overflow-visible
          "
          style={{
            fontFamily: 'Libre Baskerville, serif'
          }}
        >
          <span className="block text-[clamp(2.55rem,15.8vw,6.8rem)] leading-[1]">
            Chiroport
          </span>
        </h1>
        <p
          className="
            mt-2 sm:mt-3 mx-auto
            max-w-full
            text-[clamp(1rem,2.6vw,1.25rem)] font-semibold tracking-tight text-slate-700
            leading-tight text-center
          "
          aria-label="Queue highlights"
        >
          {queueHighlightsText}
        </p>
      </div>
      
      {/* Locations wrapper - this will expand and push content below */}
      <div className="mt-3 sm:mt-4 w-full flex flex-col items-center gap-4 mb-10">
        <div id="locations" className="w-full flex justify-center">
          <LocationsWrapper 
            buttonText="Join queue" 
          />
        </div>
      </div>

      <section className="w-full mb-5 sm:mb-6">
        <div
          className="w-full"
          style={{
            maxWidth: '760px',
            margin: '0 auto',
          }}
        >
          <details className="w-full rounded-2xl border border-slate-200/80 bg-white/85 p-3 sm:p-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.3)] [&[open]_.directions-chevron]:rotate-90">
            <summary
              className="
                flex items-center justify-between gap-3
                list-none cursor-pointer select-none rounded-xl
                px-2 py-3 text-2xl font-semibold font-lato tracking-tight text-slate-900
                transition-colors duration-200 hover:text-slate-700
                [&::-webkit-details-marker]:hidden [&::marker]:hidden
              "
            >
              <span>Locations &amp; Hours</span>
              <ChevronRightIcon
                className="directions-chevron h-5 w-5 flex-shrink-0 text-black transition-transform duration-200"
                aria-hidden
              />
            </summary>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {storeDetails.map((store) => (
                <div
                  key={store.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/85 p-4"
                >
                  <p className="text-sm sm:text-base font-semibold text-slate-900">
                    {store.label}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {store.directions}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-800">
                    Hours: {store.hours}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      </section>

      {/* Features section - now responds to menu expansion above */}
      <div className="w-full">
        <StaticFeatureCards />
      </div>
    </main>
  );
} 
