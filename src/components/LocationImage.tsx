'use client';

import Image from 'next/image';
import { useState } from 'react';

interface LocationImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * LocationImage Component
 * 
 * Displays an image of a location with error handling.
 * If the image fails to load, it will not be displayed.
 */
export default function LocationImage({ src, alt, className = '' }: LocationImageProps) {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return null;
  }

  return (
    <div className={`w-full mb-4 ${className}`}>
      <div className="w-full aspect-[16/9] relative rounded-md overflow-hidden">
        <Image 
          src={src}
          alt={alt}
          fill
          style={{ objectFit: 'cover', objectPosition: 'center center' }}
          priority
          onError={() => setImageError(true)}
        />
      </div>
    </div>
  );
} 