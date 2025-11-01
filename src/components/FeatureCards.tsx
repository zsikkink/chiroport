'use client';

import ResponsiveCard from './ResponsiveCard';
import { BodyText } from './Typography';
import { serviceItems, aboutCopy, contactInfo } from '@/content/services';

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
          {serviceItems.map((item) => (
            <li key={item} className="text-xl font-medium text-white flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </ResponsiveCard>

      {/* Two column layout for About Us and Contact */}
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <ResponsiveCard title="About Us">
          <BodyText size="xl" className="font-medium">
            {aboutCopy}
          </BodyText>
        </ResponsiveCard>
        
        <ResponsiveCard title="Contact">
          <div className="space-y-2">
            <BodyText size="xl" className="font-medium">
              Email: {contactInfo.email}
            </BodyText>
            <BodyText size="xl" className="font-medium">
              Phone: {contactInfo.phone}
            </BodyText>
          </div>
        </ResponsiveCard>
      </div>
    </div>
  );
} 
