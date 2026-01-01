import withPWA from "next-pwa";

const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: process.env.CI === 'true',
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
  serverExternalPackages: ["@aws-sdk/*"],
  experimental: {
    turbo: {},
  },
};

export default isProd
  ? withPWA({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: false,
    fallbacks: {
      document: "/rep/offline",
    },
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
        handler: "CacheFirst",
        options: {
          cacheName: "pdf-cache",
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
        },
      },
      {
        urlPattern: /.*/,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "static-cache" }
      }
    ]
  })(nextConfig)
  : nextConfig;
