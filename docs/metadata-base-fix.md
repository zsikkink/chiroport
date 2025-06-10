# MetadataBase Warning Fix

## The Problem

You were seeing this warning when opening location pages:

```
⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3000". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

## What It Means

- **Not an error**: This is a warning, not a breaking issue
- **Social media impact**: Without `metadataBase`, Open Graph images (for Facebook, Twitter, etc.) can't be properly resolved
- **Fallback behavior**: Next.js defaults to `localhost:3000` which breaks social sharing in production

## Root Cause

Your location pages have `generateMetadata()` functions that include Open Graph images:

```tsx
// In src/app/locations/[location]/[concourse]/page.tsx
openGraph: {
  images: [
    {
      url: concourseInfo.locationInfo.imageUrl, // Relative URL needs base
      width: 1200,
      height: 630,
    },
  ],
},
```

Without `metadataBase`, Next.js can't convert relative URLs to absolute URLs needed for social media.

## The Fix (Applied)

**Updated `src/app/layout.tsx`:**

```tsx
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
    'http://localhost:3000'
  ),
  // ... rest of metadata
};
```

## How It Works

1. **Production**: Uses `NEXT_PUBLIC_BASE_URL` (e.g., `https://chiroport.com`)
2. **Vercel Deployment**: Automatically uses `VERCEL_URL` environment variable
3. **Local Development**: Falls back to `http://localhost:3000`

## Environment Setup

Ensure your `.env.local` includes:

```bash
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## Benefits

✅ **Social sharing works**: Open Graph images now have absolute URLs  
✅ **SEO improved**: Search engines can properly index your images  
✅ **No more warnings**: Clean build and development experience  
✅ **Environment-aware**: Works across local, staging, and production  

## Best Practices Followed

- **Environment-based configuration**: Different URLs for different environments
- **Fallback strategy**: Graceful degradation if environment variables aren't set
- **Vercel optimization**: Automatic deployment URL detection
- **Type safety**: Proper TypeScript configuration with Metadata type 