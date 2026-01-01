'use client';

import Image from 'next/image';
import { useState } from 'react';

interface LocationImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  objectPosition?: string;
  preserveAspectRatio?: boolean;
}

/**
 * LocationImage Component
 * 
 * Displays an image of a location with error handling.
 * If the image fails to load, it will not be displayed.
 * 
 * Supports customizing the aspect ratio, object-fit, and object-position
 * to handle images of different dimensions appropriately.
 */
export default function LocationImage({ 
  src, 
  alt, 
  className = '',
  aspectRatio = '16/9',
  objectFit = 'cover',
  objectPosition = 'center center',
  preserveAspectRatio = false
}: LocationImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (imageError) {
    return null;
  }

  // Use aspect ratio style only if not preserving the image's natural aspect ratio
  const containerStyle = preserveAspectRatio 
    ? {} 
    : { aspectRatio };

  return (
    <div className={`w-full mb-4 ${className}`}>
      <div 
        className={`w-full relative rounded-md overflow-hidden ${!isLoaded ? 'min-h-[300px] bg-gray-200' : ''}`}
        style={containerStyle}
      >
        {preserveAspectRatio ? (
          // Use responsive layout to preserve image's natural aspect ratio
          <Image 
            src={src}
            alt={alt}
            width={1200}
            height={800}
            style={{
              width: '100%',
              height: 'auto'
            }}
            priority
            onError={() => setImageError(true)}
            onLoad={() => setIsLoaded(true)}
          />
        ) : (
          // Use fill for images where we want to control the aspect ratio
          <Image 
            src={src}
            alt={alt}
            fill
            style={{ 
              objectFit, 
              objectPosition
            }}
            priority
            onError={() => setImageError(true)}
            onLoad={() => setIsLoaded(true)}
          />
        )}
      </div>
    </div>
  );
} 