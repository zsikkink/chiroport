This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Accessibility & Text Scaling

This application is designed to handle text scaling gracefully for users with visual impairments or different text size preferences.

### Testing Text Scaling

**Browser Zoom Testing:**
1. Use `Ctrl/Cmd + '+'` to zoom to 200% and 300%
2. Ensure all content remains readable and accessible
3. Check that no text gets cut off or overlaps

**Browser Font Size Settings:**
- **Chrome**: Settings → Appearance → Font Size → Very Large
- **Firefox**: Settings → General → Fonts and Colors → Very Large  
- **Safari**: Preferences → Advanced → Accessibility → Never use font sizes smaller than [set to 18px]
- **Edge**: Settings → Appearance → Fonts → Very Large

**Mobile Testing:**
- **iOS**: Settings → Display & Brightness → Text Size → Larger Accessibility Sizes
- **Android**: Settings → Display → Font Size → Large

### Implementation Details

**CSS Strategy:**
- Uses `rem` units throughout (via Tailwind) which scale with user preferences
- Implements `clamp()` for responsive font sizes with accessibility bounds
- Ensures proper line heights and text wrapping
- Containers adapt to larger text sizes

**Key Classes for Text Scaling:**
```css
.text-scale-friendly  /* Responsive font size with clamp() */
.scale-container      /* Container that adapts to text scaling */
```

**Typography System:**
- All text components support multiple responsive breakpoints
- Proper line-height ratios for readability
- Word wrapping prevents text overflow

### WCAG Compliance

This app follows WCAG 2.1 AA guidelines:
- ✅ Text can be resized up to 200% without loss of content or functionality
- ✅ Proper contrast ratios maintained at all zoom levels
- ✅ Touch targets remain accessible at larger text sizes
- ✅ No horizontal scrolling required at 320px width with 200% zoom

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with fonts & metadata
│   ├── page.tsx           # Home page
│   ├── globals.css        # Global styles & CSS variables
│   └── locations/         # Location-based routing
│       ├── page.tsx       # Location selection page
│       └── [location]/[concourse]/
│           └── page.tsx   # Individual location details
├── components/            # Reusable UI components
├── utils/                # Utility functions & data
└── types/                # TypeScript type definitions (empty)
```
