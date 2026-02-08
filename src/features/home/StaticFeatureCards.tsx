import type { ComponentType, SVGProps } from 'react';
import { StaticBodyText, StaticResponsiveCard } from '@/components/ui';
import {
  PlusIcon,
  HandRaisedIcon,
  CursorArrowRaysIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/solid';
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
  const serviceIcons: Array<ComponentType<SVGProps<SVGSVGElement>>> = [
    PlusIcon,
    HandRaisedIcon,
    CursorArrowRaysIcon,
    ArrowsPointingOutIcon,
  ];

  return (
    <div 
      className={`w-full ${className}`}
      style={{
        maxWidth: '760px',
        margin: '0 auto'
      }}
    >
      {/* Services card - full width within constraints */}
      <div id="services">
        <StaticResponsiveCard title="Services Include" className="mb-5 sm:mb-6">
          <ul className="space-y-3">
            {serviceItems.map((item, index) => {
              const Icon = serviceIcons[index] ?? PlusIcon;
              return (
                <li key={item} className="flex items-start gap-3 text-lg sm:text-xl font-medium text-slate-700">
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              );
            })}
          </ul>
        </StaticResponsiveCard>
      </div>

      {/* Two column layout for About Us and Contact */}
      <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
        <div id="about">
          <StaticResponsiveCard title="About Us">
            <StaticBodyText size="lg" className="text-slate-600 leading-relaxed">
              {aboutCopy}
            </StaticBodyText>
            <div className="mt-4">
              <a
                href="#contact"
                className="text-sm font-semibold text-emerald-800 hover:text-emerald-900 underline underline-offset-4"
              >
                Learn more
              </a>
            </div>
          </StaticResponsiveCard>
        </div>
        
        <div id="contact">
          <StaticResponsiveCard title="Contact">
            <div className="space-y-3 text-slate-700">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Email</div>
                <StaticBodyText size="lg" className="font-medium">
                  {contactInfo.email}
                </StaticBodyText>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Phone</div>
                <StaticBodyText size="lg" className="font-medium">
                  {contactInfo.phone}
                </StaticBodyText>
              </div>
            </div>
          </StaticResponsiveCard>
        </div>
      </div>
    </div>
  );
} 
