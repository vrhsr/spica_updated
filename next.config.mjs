import withPWA from "next-pwa";

const isProd = process.env.NODE_ENV === "production";
const isCapacitor = process.env.BUILD_TARGET === "capacitor";

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,

  // ✅ DEFAULT: Normal Next.js runtime (Vercel-safe)
  // This prevents static export mode from leaking into production
  output: isCapacitor ? undefined : 'standalone',

  typescript: {
    ignoreBuildErrors: process.env.CI === 'true',
  },
  eslint: {
    ignoreDuringBuilds: process.env.CI === 'true',
  },
  images: {
    unoptimized: isCapacitor, // Required for static export
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'ezogujldmpxycodwboos.supabase.co', pathname: '/**' },
    ],
  },
  experimental: {
    turbo: {},
  },
};

// 🔒 ONLY enable export in Capacitor builds (explicit opt-in)
if (isCapacitor) {
  console.warn('⚠️ Building for Capacitor: enabling static export');
  baseConfig.output = 'export';
  baseConfig.trailingSlash = true;
}

// Web build: Normal Next.js (PWA temporarily disabled)
export default baseConfig;
