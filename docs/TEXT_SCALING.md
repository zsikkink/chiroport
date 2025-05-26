# Text Scaling and User Accessibility

This document explains how the Chiroport website ensures proper text scaling and accessibility regardless of user font size preferences.

## Overview

The website has been enhanced with comprehensive text scaling support that:
- Respects user font size preferences set in their browser or operating system
- Prevents text cutoff and overflow issues at all zoom levels
- Maintains visual hierarchy and design consistency
- Provides smooth, fluid text scaling using CSS `clamp()` functions
- Ensures accessibility compliance for users with visual impairments

## Key Features

### 1. Fluid Text Sizing System

The website uses a fluid text sizing system based on CSS custom properties and `clamp()` functions:

```css
/* CSS Custom Properties in globals.css */
--text-xs: clamp(0.75rem, 0.75rem + 0.25vw, 0.875rem);
--text-sm: clamp(0.875rem, 0.875rem + 0.25vw, 1rem);
--text-base: clamp(1rem, 1rem + 0.25vw, 1.125rem);
--text-lg: clamp(1.125rem, 1.125rem + 0.5vw, 1.375rem);
--text-xl: clamp(1.25rem, 1.25rem + 0.75vw, 1.625rem);
--text-2xl: clamp(1.5rem, 1.5rem + 1vw, 2rem);
--text-3xl: clamp(1.875rem, 1.875rem + 1.5vw, 2.5rem);
--text-4xl: clamp(2.25rem, 2.25rem + 2vw, 3.5rem);
--text-5xl: clamp(3rem, 3rem + 3vw, 5rem);
--text-6xl: clamp(3.75rem, 3.75rem + 4vw, 6rem);
```

### 2. Tailwind CSS Integration

Custom Tailwind utilities provide easy access to fluid text sizing:

```javascript
// tailwind.config.js
fontSize: {
  // Fluid text sizes that respect user preferences
  'fluid-xs': ['var(--text-xs)', { lineHeight: '1.4' }],
  'fluid-sm': ['var(--text-sm)', { lineHeight: '1.4' }],
  'fluid-base': ['var(--text-base)', { lineHeight: '1.5' }],
  'fluid-lg': ['var(--text-lg)', { lineHeight: '1.5' }],
  'fluid-xl': ['var(--text-xl)', { lineHeight: '1.5' }],
  'fluid-2xl': ['var(--text-2xl)', { lineHeight: '1.3' }],
  'fluid-3xl': ['var(--text-3xl)', { lineHeight: '1.2' }],
  'fluid-4xl': ['var(--text-4xl)', { lineHeight: '1.1' }],
  'fluid-5xl': ['var(--text-5xl)', { lineHeight: '1.05' }],
  'fluid-6xl': ['var(--text-6xl)', { lineHeight: '1.05' }],
}
```

### 3. Enhanced Typography Component

The Typography component automatically uses fluid sizing by default:

```tsx
// Default behavior - uses fluid sizing
<Typography variant="title">Scalable Title</Typography>

// Can disable fluid sizing when needed
<Typography variant="title" fluid={false}>Fixed Title</Typography>
```

### 4. Text Size Adjustment Properties

All text elements include CSS properties that prevent browsers from overriding text scaling:

```css
text-size-adjust: 100%;
-webkit-text-size-adjust: 100%;
-moz-text-size-adjust: 100%;
```

## Component Updates

### Typography Components

All typography components now use fluid sizing by default:

- `<Title>` - Uses `text-fluid-4xl`
- `<Heading>` - Uses `text-fluid-2xl`
- `<SubHeading>` - Uses `text-fluid-xl`
- `<BodyText>` - Uses `text-fluid-xl`
- `<Label>` - Uses `text-fluid-sm`

### Button Components

Button text sizes have been updated to use fluid scaling:

- Primary buttons: `text-fluid-3xl`
- Secondary buttons: `text-fluid-lg`
- Location buttons: `text-fluid-xl`
- Back buttons: `text-fluid-base`

### Hero Components

The HomeHero component uses the largest fluid text size (`text-fluid-6xl`) for maximum impact while maintaining scalability.

## Text Overflow Prevention

### Enhanced CSS Utilities

Several CSS utility classes prevent text cutoff and overflow:

```css
.mobile-text-safe {
  word-wrap: break-word;
  overflow-wrap: anywhere;
  word-break: break-word;
  hyphens: auto;
  max-width: 100%;
  width: 100%;
  text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
  -moz-text-size-adjust: 100%;
}

.no-text-cutoff {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  hyphens: auto;
  text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
}

.scale-container {
  width: 100%;
  max-width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
}
```

### Global Text Rendering

Enhanced text rendering properties are applied globally:

```css
body {
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

## Browser Support

The text scaling system supports:

- **Modern browsers**: Full support for `clamp()` and CSS custom properties
- **Safari**: Enhanced WebKit text size adjustment support
- **Firefox**: Mozilla-specific text size adjustment support
- **Chrome/Edge**: Standard text size adjustment support

## Accessibility Benefits

### WCAG Compliance

The implementation helps meet WCAG guidelines:

- **1.4.4 Resize text**: Text can be resized up to 200% without loss of functionality
- **1.4.10 Reflow**: Content reflows properly at different zoom levels
- **1.4.12 Text Spacing**: Text spacing can be adjusted without content loss

### User Preference Respect

The system respects:
- Browser zoom settings
- Operating system font size preferences
- Accessibility software text scaling
- User-defined CSS font sizes

## Testing

Comprehensive tests verify text scaling functionality:

```bash
# Run text scaling tests
npm test -- TextScaling.test.tsx

# Run all tests
npm test
```

Test coverage includes:
- Fluid text sizing application
- Text size adjustment properties
- Mobile text safety classes
- Container adaptation
- User preference simulation

## Usage Examples

### Basic Typography

```tsx
// Automatically uses fluid sizing
<Title>Page Title</Title>
<Heading>Section Heading</Heading>
<BodyText>Content that scales with user preferences</BodyText>
```

### Custom Sizing

```tsx
// Override size while maintaining fluid scaling
<Typography variant="body" size="2xl">
  Large body text
</Typography>

// Disable fluid scaling for specific cases
<Typography variant="title" fluid={false}>
  Fixed size title
</Typography>
```

### Buttons

```tsx
// All button variants use appropriate fluid text sizes
<Button variant="primary">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="location">Location Button</Button>
```

## Best Practices

### Do's

- ✅ Use the Typography component for all text
- ✅ Let fluid sizing be the default
- ✅ Test with browser zoom at 200%
- ✅ Test with large system font sizes
- ✅ Use semantic HTML elements

### Don'ts

- ❌ Use fixed pixel font sizes
- ❌ Override text-size-adjust to "none"
- ❌ Use viewport units for small text
- ❌ Disable fluid sizing without good reason
- ❌ Ignore text overflow at large sizes

## Performance Considerations

The fluid text system is optimized for performance:

- CSS custom properties are computed once
- `clamp()` functions are hardware-accelerated
- No JavaScript required for text scaling
- Minimal impact on bundle size
- Efficient Tailwind class generation

## Future Enhancements

Potential improvements for the text scaling system:

1. **Dynamic scaling factors** based on device type
2. **User preference detection** via JavaScript
3. **Advanced container queries** for text sizing
4. **Automatic line height optimization**
5. **Enhanced print stylesheet support**

## Troubleshooting

### Common Issues

**Text appears too small on mobile:**
- Check that `text-fluid-*` classes are being used
- Verify CSS custom properties are loaded
- Test with different viewport sizes

**Text cutoff at large sizes:**
- Ensure `mobile-text-safe` class is applied
- Check container width constraints
- Verify `overflow-wrap` properties

**Inconsistent scaling:**
- Confirm all text uses Typography component
- Check for overriding CSS styles
- Verify Tailwind configuration is correct

### Debug Tools

```javascript
// Check if fluid text variables are available
const styles = getComputedStyle(document.documentElement);
console.log(styles.getPropertyValue('--text-xl'));

// Test text scaling at different zoom levels
document.documentElement.style.fontSize = '20px'; // Simulate large text
```

## Conclusion

The enhanced text scaling system ensures that the Chiroport website provides an excellent user experience regardless of individual accessibility needs or device preferences. By using fluid typography, respecting user settings, and preventing text overflow, the website maintains both visual appeal and functional accessibility across all use cases. 