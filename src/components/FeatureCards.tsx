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
 * Now works with the dynamic width system - uses full available width within
 * the 90% screen constraint set by the parent container.
 */
export default function FeatureCards({ className = '' }: FeatureCardsProps) {
  return (
    <div className={`w-full ${className}`}>
      {/* Services card - full width */}
      <ResponsiveCard title="Services" className="mb-4 sm:mb-6">
        <BodyText size="xl" className="font-medium">
          Our responsive design adapts to your device size automatically, providing the best experience whether you're on mobile, tablet, or desktop.
        </BodyText>
      </ResponsiveCard>

      {/* Two column layout for About Us and Contact */}
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
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