import { StaticBodyText, StaticResponsiveCard } from '@/components/ui';
import { serviceItems, aboutCopy, contactInfo } from '@/content/services';

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
          {serviceItems.map((item) => (
            <li key={item} className="text-xl font-medium text-slate-700 flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </StaticResponsiveCard>

      {/* Two column layout for About Us and Contact */}
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <StaticResponsiveCard title="About Us">
          <StaticBodyText size="xl" className="font-medium">
            {aboutCopy}
          </StaticBodyText>
        </StaticResponsiveCard>
        
        <StaticResponsiveCard title="Contact">
          <div className="space-y-2">
            <StaticBodyText size="xl" className="font-medium">
              Email: {contactInfo.email}
            </StaticBodyText>
            <StaticBodyText size="xl" className="font-medium">
              Phone: {contactInfo.phone}
            </StaticBodyText>
          </div>
        </StaticResponsiveCard>
      </div>
    </div>
  );
} 
