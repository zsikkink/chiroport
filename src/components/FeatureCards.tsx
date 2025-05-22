'use client';

import ResponsiveCard from './ResponsiveCard';
import { BodyText } from './Typography';

interface FeatureCardsProps {
  className?: string;
}

/**
 * FeatureCards Component
 * 
 * Displays a section of responsive cards highlighting features and information.
 * Extracted from HomePage for better component organization.
 */
export default function FeatureCards({ className = '' }: FeatureCardsProps) {
  // Container classes for the cards section
  const containerClasses = [
    'w-full max-w-3xl gap-6 px-2 sm:px-4',
    'mt-2 sm:mt-4',
    className
  ].filter(Boolean).join(' ');
  
  // Grid layout for the two-column section
  const twoColGridClasses = 'grid sm:grid-cols-2 gap-4 sm:gap-6';
  
  return (
    <div className={containerClasses}>
      {/* Services card - full width */}
      <ResponsiveCard title="Services" className="mb-4">
        <BodyText size="xl" className="font-medium">
          Our responsive design adapts to your device size automatically, providing the best experience whether you're on mobile, tablet, or desktop.
        </BodyText>
      </ResponsiveCard>

      {/* Two column layout for About Us and Contact */}
      <div className={twoColGridClasses}>
        <ResponsiveCard title="About Us">
          <ul className="list-disc list-inside space-y-2 font-lato text-xl font-medium">
            <li>Responsive design</li>
            <li>Container queries</li>
            <li>Accessible components</li>
          </ul>
        </ResponsiveCard>
        
        <ResponsiveCard title="Contact">
          <BodyText size="xl" className="font-medium">
            Get in touch with our team to learn more about our services.
          </BodyText>
        </ResponsiveCard>
      </div>
    </div>
  );
} 