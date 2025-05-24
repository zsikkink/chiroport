/**
 * Text Cutoff Testing Utilities
 * 
 * Helper functions to test and verify that text never gets cut off
 * on different screen sizes and with different text scaling settings.
 */

/**
 * Check if any text elements are getting cut off
 * Run this in browser console to detect cutoff issues
 */
export function detectTextCutoff(): void {
  if (typeof window === 'undefined') return;
  
  const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div');
  const issues: Array<{ element: Element; issue: string }> = [];
  
  textElements.forEach((element) => {
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    // Check for horizontal overflow
    if (element.scrollWidth > element.clientWidth) {
      issues.push({
        element,
        issue: `Horizontal overflow: scrollWidth(${element.scrollWidth}) > clientWidth(${element.clientWidth})`
      });
    }
    
    // Check for text-overflow ellipsis
    if (styles.textOverflow === 'ellipsis') {
      issues.push({
        element,
        issue: 'Uses text-overflow: ellipsis which can cut off text'
      });
    }
    
    // Check for hidden overflow
    if (styles.overflow === 'hidden' && element.textContent && element.textContent.length > 0) {
      issues.push({
        element,
        issue: 'Has overflow: hidden which might cut off text'
      });
    }
    
    // Check if element extends beyond viewport
    if (rect.right > window.innerWidth) {
      issues.push({
        element,
        issue: `Element extends beyond viewport: right(${rect.right}) > viewport(${window.innerWidth})`
      });
    }
  });
  
  if (issues.length === 0) {
    console.log('✅ No text cutoff issues detected!');
  } else {
    console.warn('⚠️ Potential text cutoff issues found:', issues);
  }
}

/**
 * Test text scaling at different zoom levels
 * Simulates browser zoom by changing the root font size
 */
export function testTextScaling(): void {
  if (typeof window === 'undefined') return;
  
  const originalFontSize = window.getComputedStyle(document.documentElement).fontSize;
  const zoomLevels = [1, 1.25, 1.5, 2, 2.5, 3];
  
  console.log('Testing text scaling at different zoom levels...');
  
  zoomLevels.forEach((zoom, index) => {
    setTimeout(() => {
      document.documentElement.style.fontSize = `${16 * zoom}px`;
      console.log(`Zoom ${zoom * 100}%: Root font size set to ${16 * zoom}px`);
      
      // Check for issues at this zoom level
      detectTextCutoff();
      
      // Reset to original if this is the last test
      if (index === zoomLevels.length - 1) {
        setTimeout(() => {
          document.documentElement.style.fontSize = originalFontSize;
          console.log('Reset to original font size');
        }, 1000);
      }
    }, index * 2000);
  });
}

/**
 * Simulate mobile device sizes
 * Tests common mobile viewport sizes to ensure text doesn't cut off
 */
export function testMobileViewports(): void {
  if (typeof window === 'undefined') return;
  
  const viewports = [
    { width: 320, height: 568, name: 'iPhone SE' },
    { width: 375, height: 667, name: 'iPhone 8' },
    { width: 414, height: 896, name: 'iPhone 11' },
    { width: 360, height: 640, name: 'Galaxy S5' },
    { width: 412, height: 915, name: 'Pixel 5' },
  ];
  
  console.log('Testing mobile viewports...');
  
  viewports.forEach((viewport, index) => {
    setTimeout(() => {
      // Note: This only works in developer tools device simulation
      console.log(`Testing ${viewport.name}: ${viewport.width}x${viewport.height}`);
      console.log('Please manually resize your browser or use device simulation');
      detectTextCutoff();
    }, index * 1000);
  });
}

/**
 * Quick test function to run all text cutoff checks
 * Use this in browser console: textCutoffTest()
 */
export function runAllTextCutoffTests(): void {
  console.log('🔍 Running comprehensive text cutoff tests...');
  
  // Immediate check
  detectTextCutoff();
  
  // Wait a bit, then test scaling
  setTimeout(() => {
    testTextScaling();
  }, 2000);
  
  // Test mobile viewports
  setTimeout(() => {
    testMobileViewports();
  }, 20000);
}

// Make functions available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).detectTextCutoff = detectTextCutoff;
  (window as any).testTextScaling = testTextScaling;
  (window as any).testMobileViewports = testMobileViewports;
  (window as any).textCutoffTest = runAllTextCutoffTests;
} 