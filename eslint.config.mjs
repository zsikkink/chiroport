import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
  {
    ignores: [
      'coverage/**',
      'scripts/**',
      'supabase/**',
      '*.config.*',
      'tailwind.config.js',
      'postcss.config.mjs',
      'jest.config.js',
      'playwright.config.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@/server', '@/server/*', '@/server/**'],
        },
      ],
    },
  },
];
