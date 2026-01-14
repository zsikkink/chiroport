# Chiroport

A modern, responsive web application for managing chiropractic services across major US airports. Built with Next.js 14, TypeScript, and Tailwind CSS.

## 🚀 Features

- **Multi-Airport Support**: Services across Atlanta, Dallas, Houston, Las Vegas, and Minneapolis airports
- **Queue Management**: Supabase-backed walk-in queue with realtime updates
- **Responsive Design**: Mobile-first approach with accessibility features
- **Real-time Updates**: Dynamic location information and availability
- **Optimized Performance**: Image optimization, lazy loading, and efficient animations

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom CSS variables
- **Fonts**: Google Fonts (Lato + Libre Baskerville)
- **Queue System**: Supabase Postgres + Realtime
- **Messaging**: Twilio SMS
- **Images**: Optimized WebP with JPEG fallbacks

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── globals.css        # Global styles and animations
│   ├── layout.tsx         # Root layout with fonts and metadata
│   ├── page.tsx           # Home page
│   └── locations/         # Location-specific routes
├── components/            # Reusable React components
│   ├── Button.tsx         # Button system with variants
│   ├── ErrorBoundary.tsx  # Error handling component
│   ├── LoadingSpinner.tsx # Loading states
│   ├── Typography.tsx     # Text components
│   └── ...               # Other UI components
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions and data
│   ├── config.ts         # Environment configuration
│   ├── locationData.ts   # Centralized location data
│   └── theme.ts          # Design system constants
└── public/               # Static assets
    ├── icons/            # SVG icons
    └── images/           # Location photos
```

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Getting Started
```bash
# Clone the repository
git clone <repository-url>
cd chiroport

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

### Environment Variables
Create a `.env.local` file:
```env
# Optional: Feature flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_ERROR_REPORTING=true
NEXT_PUBLIC_DEBUG_MODE=false

# Optional: Performance settings
NEXT_PUBLIC_IMAGE_QUALITY=85
NEXT_PUBLIC_CACHE_TIMEOUT=300000
```

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
```

## 📍 Adding New Locations

### 1. Update Location Data
Edit `data/locationData.json`:

```json
{
  "airports": [
    {
      "name": "New Airport",
      "code": "NEW",
      "slug": "new-airport",
      "concourses": [
        {
          "name": "concourse-a",
          "slug": "concourse-a",
          "displayName": "Concourse A",
          "locationInfo": {
            "gate": "A12",
            "landmark": "Starbucks",
            "airportCode": "NEW",
            "imageUrl": "/images/stores/new-a.webp",
            "customLocation": "Near Gate A12, next to Starbucks.",
            "customHours": "8am - 6pm ET",
            "displayName": "Concourse A",
            "intakeCategory": "standard"
          }
        }
      ]
    }
  ]
}
```

### 2. Add Location Images
Place images in `public/images/stores/`:
- `new-a.webp` (preferred format)
- `new-a.jpeg` (fallback format)

## 🎨 Design System

### Colors
```css
--color-primary: #56655A        /* Soft green */
--color-primary-dark: #475549   /* Darker green */
--color-text-primary: #ffffff   /* White text */
```

### Typography
- **Body**: Lato (sans-serif)
- **Headings/Logo**: Libre Baskerville (serif)
- **Responsive**: Uses `clamp()` for fluid scaling

### Components
- **Buttons**: 4 variants (primary, secondary, location, back)
- **Typography**: Semantic components (Title, Heading, BodyText)
- **Layout**: Responsive containers with overflow protection

### Image Optimization
- **Formats**: WebP primary, JPEG fallback
- **Responsive**: Multiple sizes for different screen densities
- **Lazy Loading**: Images load as needed

### Hosting a static proof image (SMS consent)
To host an image at `https://www.thechiroport.com/sms-consent-proof.png`, place the PNG at:

- `public/sms-consent-proof.png`

Next.js serves files in `public/` from the site root, so this will be available at:

- `/sms-consent-proof.png`

### Performance
- **Font Loading**: Optimized Google Fonts with `font-display: swap`
- **CSS**: Minimal, efficient styles with Tailwind
- **JavaScript**: Code splitting and lazy loading
- **Caching**: Appropriate cache headers for static assets

## 🚨 Error Handling

### Error Boundary
Catches React errors and displays user-friendly fallbacks:
```typescript
<ErrorBoundary fallback={<CustomErrorUI />}>
  <YourComponent />
</ErrorBoundary>
```

### Loading States
- Page-level loading for route changes
- Component-level loading for async operations
- Skeleton screens for better perceived performance

## 📱 Mobile Optimization

### Responsive Design
- **Mobile-first**: Designed for small screens, enhanced for larger
- **Touch-friendly**: Appropriate touch targets (44px minimum)
- **Text Scaling**: Respects user font size preferences
- **Viewport**: Proper viewport meta tag configuration

### Accessibility
- **Semantic HTML**: Proper heading hierarchy and landmarks
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG AA compliant colors

## 🔍 Debugging

### Development Tools
```javascript
// Available in browser console during development
detectTextCutoff()     // Check for text overflow issues
debugLog(message, data) // Conditional logging
```

### Common Issues
1. **Images not displaying**: Verify file paths and formats
2. **Text cutoff**: Use `.text-safe` utility class
3. **Layout issues**: Check responsive breakpoints

## 🚀 Deployment

### Build Process
```bash
npm run build    # Creates optimized production build
npm run start    # Serves production build locally
```

### Environment Setup
- Set production environment variables
- Configure CDN for static assets
- Set up error monitoring (optional)
- Configure analytics (optional)

### Performance Checklist
- [ ] Images optimized and properly sized
- [ ] Fonts loaded efficiently
- [ ] JavaScript bundles analyzed
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals passing

## 📄 License

[Add your license information here]

## 🤝 Contributing

[Add contribution guidelines here]

## 🚀 Quick Start

### Cache-Safe Development (Recommended)

To prevent webpack cache corruption issues, use the robust development startup:

```bash
npm run dev:robust
```

This command:
- ✅ Automatically cleans all caches
- ✅ Validates the environment
- ✅ Starts a clean development server
- ✅ Prevents cache corruption issues

### Alternative Development Commands

```bash
# Standard development server
npm run dev

# Clean cache then start dev server
npm run dev:clean

# Check cache health then start dev server
npm run dev:safe
```

## 🧹 Cache Management

### Quick Fix for Cache Issues

If you see errors like "Cannot find module './447.js'" or "Missing required error components":

```bash
# Emergency reset (recommended)
npm run reset

# Or use the robust startup
npm run dev:robust
```

### Cache Monitoring

```bash
# Check cache health
npm run cache:check

# Clean all caches
npm run cache:clean

# Monitor cache continuously
npm run cache:monitor
```

## 📋 Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev:robust` | **Recommended** - Cache-safe development startup |
| `npm run dev` | Standard development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run reset` | Emergency cache cleanup and rebuild |

## 🛠️ Development Setup

1. **Clone the repository**
```bash
git clone [repository-url]
cd chiroport
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp env.template .env.local
# Edit .env.local with your API keys
```

4. **Start development (cache-safe)**
```bash
npm run dev:robust
```

## 🏗️ Tech Stack

- **Framework**: Next.js 15.5.9 with App Router
- **Language**: TypeScript
- **UI**: Tailwind CSS
- **Animations**: Framer Motion
- **Validation**: Zod
- **Testing**: Jest + React Testing Library
- **API Integration**: Supabase Edge Functions + Twilio

## 🧭 Project Structure

- `src/app`: Route handlers, layouts, and pages
- `src/components`: Shared UI primitives and layout shells
- `src/features`: Feature modules (home, locations, location-details)
- `src/lib`: Client-safe helpers (API client, location data)
- `src/server`: Server-only helpers (config, security, CSRF, API clients)

## 🚨 Troubleshooting

### Common Issues

**Cache Corruption**: If you see module loading errors, run `npm run reset`

**Development Server Won't Start**: Try `npm run dev:robust`

**Build Errors**: Run `npm run clean:full` then `npm run build`

## 📞 Support

If you encounter persistent cache issues:

1. Try `npm run dev:robust`
2. Use `npm run reset` as last resort

---

**Note**: Always use `npm run dev:robust` for the most stable development experience.
