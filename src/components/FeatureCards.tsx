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
 * Maximum width of 800px with auto centering for optimal readability.
 */
export default function FeatureCards({ className = '' }: FeatureCardsProps) {
  return (
    <div 
      className={`w-full ${className}`}
      style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}
    >
      {/* Services card - full width within constraints */}
      <ResponsiveCard title="Services Include" className="mb-4 sm:mb-6">
        <ul className="list-disc list-inside space-y-2">
          <li className="text-xl font-medium text-white flex items-start">
            <span className="mr-2">•</span>
            <span>Chiropractic adjustments</span>
          </li>
          <li className="text-xl font-medium text-white flex items-start">
            <span className="mr-2">•</span>
            <span>Massage</span>
          </li>
          <li className="text-xl font-medium text-white flex items-start">
            <span className="mr-2">•</span>
            <span>Trigger point muscle therapy</span>
          </li>
          <li className="text-xl font-medium text-white flex items-start">
            <span className="mr-2">•</span>
            <span>Stretching</span>
          </li>
        </ul>
      </ResponsiveCard>

      {/* Two column layout for About Us and Contact */}
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <ResponsiveCard title="About Us">
          <BodyText size="xl" className="font-medium">
            The Chiroport offers wellness care in ATL, DFW, HOU, LAS, MSP airports. Our services are designed to relieve tension, stress, and pain for travelers. Join the queue to feel great at the gate!
          </BodyText>
        </ResponsiveCard>
        
        <ResponsiveCard title="Contact">
          <div className="space-y-2">
            <BodyText size="xl" className="font-medium">
              Email: info@thechiroport.com
            </BodyText>
            <BodyText size="xl" className="font-medium">
              Phone: (612) 568-1224
            </BodyText>
          </div>
        </ResponsiveCard>
      </div>
    </div>
  );
} 
