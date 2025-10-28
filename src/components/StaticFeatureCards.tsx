import StaticResponsiveCard from './StaticResponsiveCard';
import { StaticBodyText } from './StaticTypography';

interface StaticFeatureCardsProps {
  className?: string;
}

/**
 * StaticFeatureCards Component (Server-Side Rendered)
 * 
 * Server-rendered version that displays feature information without client-side interactivity.
 * This improves SEO and initial page load performance.
 */
export default function StaticFeatureCards({ className = '' }: StaticFeatureCardsProps) {
  return (
    <div 
      className={`w-full ${className}`}
      style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}
    >
      {/* Services card - full width within constraints */}
      <StaticResponsiveCard title="Services Include" className="mb-4 sm:mb-6">
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
      </StaticResponsiveCard>

      {/* Two column layout for About Us and Contact */}
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <StaticResponsiveCard title="About Us">
          <StaticBodyText size="xl" className="font-medium">
            The Chiroport offers wellness care in ATL, DFW, HOU, LAS, MSP airports. Our services are designed to relieve tension, stress, and pain for travelers. Join the queue to feel great at the gate!
          </StaticBodyText>
        </StaticResponsiveCard>
        
        <StaticResponsiveCard title="Contact">
          <div className="space-y-2">
            <StaticBodyText size="xl" className="font-medium">
              Email: info@thechiroport.com
            </StaticBodyText>
            <StaticBodyText size="xl" className="font-medium">
              Phone: (612) 568-1224
            </StaticBodyText>
          </div>
        </StaticResponsiveCard>
      </div>
    </div>
  );
} 
