import withPWA from "next-pwa";

const isProd = process.env.NODE_ENV === "production";
const isCapacitor = process.env.BUILD_TARGET === "capacitor";

const baseConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: process.env.CI === 'true',
  },
  eslint: {
    ignoreDuringBuilds: process.env.CI === 'true',
  },
  images: {
    unoptimized: isCapacitor,
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'ezogujldmpxycodwboos.supabase.co', pathname: '/**' },
    ],
  },
  serverExternalPackages: ["@aws-sdk/*"],
  experimental: {
    turbo: {},
  },
};

// Capacitor build: Static export (no PWA)
if (isCapacitor) {
  baseConfig.output = 'export';
  baseConfig.trailingSlash = true;
}

// Temporarily disable PWA to fix build errors
// Web build: Normal Next.js (no PWA)
export default baseConfig;
