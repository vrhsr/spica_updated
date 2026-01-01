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
      // ⚡ CRITICAL: Cache app shell so it loads offline (Domain Specific: spicasg.in OR Vercel)
      {
        urlPattern: /^https?:\/\/(www\.)?(spicasg\.in|spica-virid\.vercel\.app)\/(_next|static|favicon\.ico|manifest\.json|logo\.png|icon-.*\.png|pdf\.worker\.min\.js).*/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "app-shell-spicasg",
          matchOptions: { ignoreVary: true },
        },
      },
      // 🧱 Cache PDFs from Supabase (fallback) or other external sources
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
