'use client';

// app/page.tsx
import ResponsiveLayout from '@/components/ResponsiveLayout';
import HomeHero from '@/components/HomeHero';
import FeatureCards from '@/components/FeatureCards';

/**
 * Home Page
 * 
 * The main landing page for the Chiroport application.
 * Displays a hero section with a title and main CTA button,
 * followed by feature cards highlighting services and information.
 */
export default function Home() {
  return (
    <ResponsiveLayout>
      <main className="flex min-h-screen flex-col items-center overflow-x-hidden py-6 sm:py-10 md:py-12 px-4 sm:px-6 md:px-8">
        {/* Hero section with title and main CTA */}
        <HomeHero
          title="Chiroport"
          buttonText="Join Queue"
          buttonLink="/locations"
        />
        
        {/* Features section with responsive cards */}
        <FeatureCards />
      </main>
    </ResponsiveLayout>
  );
}