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
 * Extracted from HomePage for better component organization.
 */
export default function HomeHero({ 
  title, 
  buttonText, 
  buttonLink 
}: HomeHeroProps) {
  const router = useRouter();
  
  // Classes for responsive layout and spacing
  const titleSectionClasses = [
    'w-full overflow-visible text-center',
    'pt-3 sm:pt-4 md:pt-5',
    'pb-4 sm:pb-6',
    'px-2',
  ].join(' ');
  
  // Classes for the title itself
  const titleClasses = [
    'text-[4rem] sm:text-[5rem] md:text-[6rem] lg:text-[8rem]',
    'text-center',
    'mb-4 sm:mb-6',
    'leading-[1.1]',
    'tracking-tight',
    'max-w-[90vw]',
    'py-1',
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
        <Title size="6xl" className={titleClasses}>
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