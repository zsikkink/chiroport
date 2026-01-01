import { MetadataRoute } from 'next';
import { airportLocations } from '@/lib';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chiroport.com';
  
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];

  // Dynamic location routes
  const locationRoutes: MetadataRoute.Sitemap = [];
  
  airportLocations.forEach((airport) => {
    airport.concourses.forEach((concourse) => {
      locationRoutes.push({
        url: `${baseUrl}/locations/${airport.slug}/${concourse.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.8,
      });
    });
  });

  return [...staticRoutes, ...locationRoutes];
} 
