/** 
 * PostCSS Configuration File
 * @type {import('postcss-load-config').Config} 
 * 
 * This configuration sets up the PostCSS processing pipeline for the project,
 * enabling Tailwind CSS and Autoprefixer for better browser compatibility.
 */
export default {
  plugins: {
    /**
     * Tailwind CSS - Utility-first CSS framework
     * Processes @tailwind directives and generates utility classes
     */
    tailwindcss: {},
    
    /**
     * Autoprefixer - Adds vendor prefixes to CSS
     * Ensures CSS works across different browsers by adding
     * appropriate prefixes based on Can I Use data
     */
    autoprefixer: {},
  },
};
