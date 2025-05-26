# Chiroport

A modern, responsive web application for managing chiropractic services across major US airports. Built with Next.js 14, TypeScript, and Tailwind CSS.

## 🚀 Features

- **Multi-Airport Support**: Services across Atlanta, Dallas, Houston, Las Vegas, and Minneapolis airports
- **Queue Management**: Integrated Waitwhile system for appointment scheduling
- **Responsive Design**: Mobile-first approach with accessibility features
- **Real-time Updates**: Dynamic location information and availability
- **Optimized Performance**: Image optimization, lazy loading, and efficient animations

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom CSS variables
- **Fonts**: Google Fonts (Lato + Libre Baskerville)
- **Queue System**: Waitwhile embedded widgets
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
# Optional: Custom Waitwhile script URL
NEXT_PUBLIC_WAITWHILE_SCRIPT_URL=https://cdn.jsdelivr.net/npm/@waitwhile/waitwhile-embed/dist/waitwhile-embed.min.js

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
Edit `src/utils/locationData.ts`:

```typescript
// Add to airportMap
export const airportMap = {
  // ... existing airports
  'new-airport': 'NEW',
};

// Add to locationDataMap
const locationDataMap: Record<string, LocationInfo> = {
  // ... existing locations
  'new-airport-concourse-a': {
    gate: 'A12',
    landmark: 'Starbucks',
    airportCode: 'NEW',
    imageUrl: getImagePath('new', 'a'),
    customLocation: 'Near Gate A12, next to Starbucks',
    customHours: '8am - 6pm ET',
    waitwhileId: 'your-waitwhile-location-id'
  },
};

// Add to airportLocations
export const airportLocations = [
  // ... existing airports
  {
    name: 'New Airport',
    code: 'NEW',
    concourses: [
      { name: 'concourse-a', route: 'new-airport/concourse-a', displayName: 'Concourse A' }
    ]
  }
];
```

### 2. Add Location Images
Place images in `public/images/stores/`:
- `new-a.webp` (preferred format)
- `new-a.jpeg` (fallback format)

### 3. Get Waitwhile Location ID
1. Log into your Waitwhile dashboard
2. Navigate to the specific location
3. Copy the location ID from the URL or settings
4. Update the `waitwhileId` in the location data

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

## 🔧 Configuration

### Waitwhile Integration
The app integrates with Waitwhile for queue management:

1. **Script Loading**: Loaded in `layout.tsx` with `beforeInteractive` strategy
2. **Error Handling**: Graceful fallbacks if Waitwhile fails to load
3. **Loading States**: User feedback during initialization
4. **Retry Logic**: Users can retry failed connections

### Image Optimization
- **Formats**: WebP primary, JPEG fallback
- **Responsive**: Multiple sizes for different screen densities
- **Lazy Loading**: Images load as needed

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

### Waitwhile Errors
- Connection timeouts (10 seconds)
- Service unavailable fallbacks
- Retry mechanisms
- User-friendly error messages

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
1. **Waitwhile not loading**: Check network connectivity and script URL
2. **Images not displaying**: Verify file paths and formats
3. **Text cutoff**: Use `.text-safe` utility class
4. **Layout issues**: Check responsive breakpoints

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
