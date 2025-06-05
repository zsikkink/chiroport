import StaticLayout from '@/components/StaticLayout';
import DynamicHomeContent from '@/components/DynamicHomeContent';
import ScrollHeader from '@/components/ScrollHeader';

/**
 * Home Page (Server-Side Rendered)
 * 
 * The main landing page for the Chiroport application.
 * Now server-rendered for better SEO and initial performance.
 * Uses StaticLayout for server-side rendering and direct imports for client components.
 * Dynamic content including responsive feature cards is handled by client components.
 */
export default function Home() {
  return (
    <>
      {/* Scroll-aware header - client component */}
      <ScrollHeader title="" />
      
      <StaticLayout>
        {/* Dynamic content including title, menu, and responsive feature cards */}
        <DynamicHomeContent />
      </StaticLayout>
    </>
  );
}