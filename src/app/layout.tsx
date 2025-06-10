import type { Metadata, Viewport } from "next";
import { Lato, Libre_Baskerville } from "next/font/google";
import "./globals.css";

/**
 * Configure Lato font for body text
 * - The variable name becomes a CSS variable in :root
 * - Optimizes font loading and reduces layout shift
 */
const lato = Lato({
  variable: "--font-lato", // Creates CSS variable for use in globals.css
  subsets: ["latin"],      // Loads only Latin character subset for performance
  weight: ["400", "700"],  // Load only regular and bold weights to reduce bundle size
});

/**
 * Configure Libre Baskerville for logo and headings
 * - Adds an elegant, serif font for contrast with body text
 * - Loads minimal weights to optimize performance
 */
const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville", // Creates CSS variable for use in globals.css
  subsets: ["latin"],                   // Loads only Latin character subset
  weight: ["400", "700"],               // Load only regular and bold weights
});

/**
 * Site-wide metadata configuration
 * - Sets document title, description, and favicon
 * - These values are used for SEO and browser tabs
 * - metadataBase is required for Open Graph images and social sharing
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
    'http://localhost:3000'
  ),
  title: "Chiroport",                      // Browser tab title
  description: "Walk-in chiropractic services at airport locations nationwide. Quick, professional wellness care while you travel.", // Improved description for search engines
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.ico', type: 'image/x-icon' }
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

/**
 * Viewport configuration for responsive design
 * - Controls how the site appears on different devices
 * - Proper scaling settings for mobile compatibility
 */
export const viewport: Viewport = {
  width: 'device-width',        // Makes site responsive to device width
  initialScale: 1,              // Initial zoom level when page loads
  maximumScale: 5,              // Maximum zoom level allowed
};

/**
 * Root layout component
 * - Wraps all pages in the app
 * - Provides font variables and basic HTML structure
 * - Applied consistently across all routes
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lato.variable} ${libreBaskerville.variable} antialiased max-w-full overflow-x-hidden`}>
        {children}
      </body>
    </html>
  );
}
