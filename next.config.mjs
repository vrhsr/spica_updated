/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: process.env.CI === 'true', // ONLY ignore in CI, not dev
  },
  eslint: {
    ignoreDuringBuilds: process.env.CI === 'true',
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'ezogujldmpxycodwboos.supabase.co', pathname: '/**' },
    ],
  },

  experimental: {
    serverExternalPackages: ["@aws-sdk/*"],
    turbo: {
      // no unnecessary aliasing
    },
  },
};

export default nextConfig;
