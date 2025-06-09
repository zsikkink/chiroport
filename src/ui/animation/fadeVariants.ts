/**
 * Fade Animation Variants
 * 
 * Standard fade transition animations for Framer Motion components
 */

export const fadeVariants = {
  initial: { 
    opacity: 0 
  },
  animate: { 
    opacity: 1, 
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } 
  },
  exit: { 
    opacity: 0, 
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } 
  }
}; 