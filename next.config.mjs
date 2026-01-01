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

    // Offline fallback - redirect to offline.html which auto-redirects to /rep/offline
    fallbacks: {
      document: "/offline.html",
    },

    runtimeCaching: [
      // ⚡ CRITICAL: Cache app shell so it loads offline
      {
        urlPattern: /^\/_next\/.*/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "app-shell-next",
          matchOptions: { ignoreVary: true },
        },
      },
      {
        urlPattern: /^\/static\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "app-shell-static",
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 }
        },
      },
      {
        urlPattern: /\/(favicon\.ico|manifest\.json|icon-.*\.png|logo\.png|pdf\.worker\.min\.js)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "app-shell-assets",
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 }
        },
      },
      // 🧱 Cache PDFs from Supabase storage (for any that still use URL fallback)
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*\.(pdf)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "pdf-cache",
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
        },
      },
      // 🎛 Default - cache everything else with network-first strategy
      {
        urlPattern: /.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "default-cache",
          networkTimeoutSeconds: 3,
        }
      }
    ]
  })(nextConfig)
  : nextConfig;
