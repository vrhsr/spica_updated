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
    unoptimized: isCapacitor, // Required for static export
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
  baseConfig.trailingSlash = true; // Better for file-based routing
}

// Web build: PWA with Service Worker
// TEMPORARILY DISABLED: Build errors with static generation
// Will re-enable after fixing component architecture
export default baseConfig;

/* 
export default isProd && !isCapacitor
  ? withPWA({
    dest: "public",
    register: true,
    skipWaiting: false,
    disable: false,

    fallbacks: {
      document: "/offline.html",
    },

    runtimeCaching: [
      {
        urlPattern: /^\/rep\/(offline|present|doctors|requests|page)/,
        handler: "NetworkFirst",
        options: {
          cacheName: "rep-pages",
          networkTimeoutSeconds: 3,
        },
      },
      {
        urlPattern: /^\/rep-login/,
        handler: "CacheFirst",
        options: {
          cacheName: "rep-auth",
        },
      },
      {
        urlPattern: /^\/(_next|static|favicon\.ico|manifest\.json|logo\.png|icon-.*\.png|pdf\.worker\.min\.js)/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "rep-app-shell",
        },
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*\.(pdf)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "rep-pdf-cache",
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
        },
      },
      {
        urlPattern: /.*/,
handler: "NetworkFirst",
  options: {
  cacheName: "rep-default-cache",
    networkTimeoutSeconds: 3,
        }
      }
    ]
  }) (baseConfig)
  : baseConfig;
*/
