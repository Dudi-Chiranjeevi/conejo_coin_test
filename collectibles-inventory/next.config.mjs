/** @type {import('next').NextConfig} */
const nextConfig = {
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  
  // Settings for production deployment
  // Remove assetPrefix to let Next.js handle static assets correctly
  // assetPrefix: process.env.NODE_ENV === 'production' ? 'https://www.conejocoin.net' : '',
  basePath: '',
  
  // Update BACKEND_URL to match our new unified API gateway structure
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://www.conejocoin.net',
    COINS_CATEGORY_ID: process.env.COINS_CATEGORY_ID,
    CLIENT_ID: process.env.CLIENT_ID,
  },
}

export default nextConfig