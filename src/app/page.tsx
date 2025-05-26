'use client';

// app/page.tsx
import ResponsiveLayout from '@/components/ResponsiveLayout';
import HomeHero from '@/components/HomeHero';
import FeatureCards from '@/components/FeatureCards';
import ScrollHeader from '@/components/ScrollHeader';
import LocationsWrapper from '@/components/LocationsWrapper';

/**
 * Home Page
 * 
 * The main landing page for the Chiroport application.
 * Displays a scroll-aware header, hero section with title,
 * animated locations wrapper, and feature cards.
 */
export default function Home() {
  return (
    <>
      {/* Scroll-aware header */}
      <ScrollHeader title="" />
      
      <ResponsiveLayout>
        <main className="flex min-h-screen flex-col items-center overflow-x-hidden pt-20 py-6 sm:py-10 md:py-12 px-4 sm:px-6 md:px-8">
          {/* Hero section with title */}
          <HomeHero title="Chiroport" />
          
          {/* Locations wrapper with animated border */}
          <div className="flex justify-center w-full mb-8 sm:mb-10">
            <LocationsWrapper buttonText="Locations" />
          </div>
          
          {/* Features section */}
          <FeatureCards />
        </main>
      </ResponsiveLayout>
    </>
  );
}