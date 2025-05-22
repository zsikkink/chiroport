#!/bin/bash
echo "Stopping any running Next.js servers..."
npx kill-port 3000
echo "Cleared port 3000"
echo "Clearing browser cache files..."
rm -rf .next/cache
echo "Cleared Next.js cache"
echo "Starting development server..."
npm run dev 