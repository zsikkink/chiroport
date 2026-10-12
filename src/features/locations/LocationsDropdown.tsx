'use client';

import { useRouter } from 'next/navigation';
import { DropdownCard, LocationButton } from '@/components/ui';
import { airportLocations, getLocationRoute } from '@/lib';

export default function LocationsList() {
  const router = useRouter();

  const openLocation = (airportSlug: string, concourseSlug: string) => {
    router.push(getLocationRoute(airportSlug, concourseSlug), { scroll: true });
  };

  return (
    <div className="w-full overflow-hidden">
      {airportLocations.map((airport) => {
        const firstConcourse = airport.concourses[0];
        const directDestination =
          airport.concourses.length === 1 && firstConcourse
            ? () => openLocation(airport.slug, firstConcourse.slug)
            : undefined;

        return (
          <DropdownCard
            key={airport.slug}
            title={`${airport.name} Airport`}
            className="mb-2 last:mb-0"
            {...(directDestination ? { onClick: directDestination } : {})}
          >
            <div className="space-y-2">
              {airport.concourses.map((concourse) => (
                <LocationButton
                  key={concourse.slug}
                  fullWidth
                  onClick={() => openLocation(airport.slug, concourse.slug)}
                  className="min-h-10 w-full overflow-hidden rounded-md border border-white/25 bg-[var(--color-header)] text-[clamp(0.9rem,3vw,1.25rem)] text-white shadow-[0_10px_20px_-16px_rgba(15,23,42,0.48)] transition-colors duration-200 hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white motion-reduce:!transform-none motion-reduce:transition-none"
                >
                  <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center font-medium text-white">
                    {concourse.displayName}
                  </span>
                </LocationButton>
              ))}
            </div>
          </DropdownCard>
        );
      })}
    </div>
  );
}
