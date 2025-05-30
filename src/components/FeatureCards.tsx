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
      <ResponsiveCard title="Services Include" className="mb-4 sm:mb-6">
  <ul className="list-disc list-inside space-y-2">
    <li>
      <BodyText size="xl" className="font-medium">
        Chiropractic adjustments
      </BodyText>
    </li>
    <li>
      <BodyText size="xl" className="font-medium">
        Trigger point muscle therapy
      </BodyText>
    </li>
    <li>
      <BodyText size="xl" className="font-medium">
        Massage
      </BodyText>
    </li>
    <li>
      <BodyText size="xl" className="font-medium">
        Stretching
      </BodyText>
    </li>
  </ul>
</ResponsiveCard>

      {/* Two column layout for About Us and Contact */}
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <ResponsiveCard title="About Us">
          <BodyText size="xl" className="font-medium">
            The Chiroport is a pre-flight wellness studio specializing in chiropractic and holistic care for travelers. With convenient locations at Minneapolis–St. Paul (MSP), Dallas–Fort Worth (DFW), Las Vegas (LAS), Houston (IAH), and Atlanta (ATL), we help you reduce tension and boost vitality before boarding. Our expert team tailors each session to your needs—whether you&apos;re seeking relief from stiffness, improved mobility, or deep relaxation—so you step onto your flight balanced, energized, and ready for adventure.
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