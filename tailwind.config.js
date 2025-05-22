/** 
 * Tailwind CSS Configuration
 * @type {import('tailwindcss').Config} 
 * 
 * This configuration defines how Tailwind CSS generates utility classes
 * and customizes the framework for the Chiroport project.
 */
module.exports = {
  // Specify files to scan for class names to include in the final CSS
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",     // Pages directory
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}", // Components directory
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",        // App router directory
  ],
  theme: {
    extend: {
      // Define custom colors that match CSS variables
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
          light: 'var(--color-primary-light)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          dark: 'var(--color-text-dark)',
        },
        ui: {
          border: 'var(--color-ui-border)',
          shadow: 'var(--color-ui-shadow)',
          background: 'var(--color-ui-background)',
        },
      },
      
      // Define custom breakpoints for responsive design
      screens: {
        'xs': '375px',   // Extra small devices (larger phones)
        'sm': '640px',   // Small devices (tablets)
        'md': '768px',   // Medium devices (larger tablets)
        'lg': '1024px',  // Large devices (laptops)
        'xl': '1280px',  // Extra large devices (desktops)
        '2xl': '1536px', // Extra extra large devices (large desktops)
      },
      
      // Define custom font families
      fontFamily: {
        'lato': ['var(--font-lato)', 'sans-serif'],
        'libre-baskerville': ['var(--font-libre-baskerville)', 'serif'],
      },
      
      // Custom spacing values
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      
      // Custom box shadow values
      boxShadow: {
        'card': '0 4px 6px -1px var(--color-ui-shadow), 0 2px 4px -1px var(--color-ui-shadow)',
        'button': '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  // Additional plugins for extending Tailwind's functionality
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
}; 