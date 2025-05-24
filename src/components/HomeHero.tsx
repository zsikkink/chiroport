'use client';

import { useRouter } from 'next/navigation';
import { Title } from './Typography';
import { PrimaryButton } from './Button';

interface HomeHeroProps {
  title: string;
  buttonText: string;
  buttonLink: string;
}

/**
 * HomeHero Component 
 * 
 * Displays a large title and primary CTA button.
 * Optimized to prevent text cutoff on any device size.
 */
export default function HomeHero({ 
  title, 
  buttonText, 
  buttonLink 
}: HomeHeroProps) {
  const router = useRouter();
  
  // Classes for responsive layout and spacing - mobile-first approach
  const titleSectionClasses = [
    'w-full text-center',
    'pt-3 sm:pt-4 md:pt-5',
    'pb-4 sm:pb-6',
    'px-4 sm:px-2', // More padding on mobile to prevent edge cutoff
    'scale-container', // Use our new scale-friendly container
  ].join(' ');
  
  // Mobile-first title classes that prevent cutoff
  const titleClasses = [
    // Mobile-first responsive sizing - starts smaller, scales up
    'text-[clamp(2.5rem,12vw,8rem)]', // Fluid scaling from 2.5rem to 8rem
    'text-center',
    'mb-4 sm:mb-6',
    'leading-[1.1]',
    'tracking-tight',
    'w-full', // Full width instead of max-w constraint
    'py-1',
    'mobile-text-safe', // Apply our mobile text protection
    'no-text-cutoff', // Ensure no cutoff ever happens
  ].join(' ');
  
  // Container for button
  const buttonContainerClasses = 'flex justify-center w-full mb-8 sm:mb-10';
  
  // Function to handle button click and navigate
  const handleButtonClick = () => {
    router.push(buttonLink);
  };
  
  return (
    <>
      <div className={titleSectionClasses}>
        <Title 
          size="6xl" 
          className={titleClasses}
          style={{
            // Additional inline styles for maximum compatibility
            wordWrap: 'break-word',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            hyphens: 'auto',
            maxWidth: '100%',
            width: '100%',
          }}
        >
          {title}
        </Title>
      </div>
      
      <div className={buttonContainerClasses}>
        <PrimaryButton
          onClick={handleButtonClick}
          icon="→"
        >
          {buttonText}
        </PrimaryButton>
      </div>
    </>
  );
} 