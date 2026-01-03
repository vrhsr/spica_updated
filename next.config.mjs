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
export default isProd && !isCapacitor
    ? withPWA({
        dest: "public",
        register: true,
        skipWaiting: false, // Changed to false - allow user to control updates
        disable: false,

        fallbacks: {
            document: "/offline.html",
        },

        runtimeCaching: [
            {
                urlPattern: /^\/(_next|static|favicon\.ico|manifest\.json|logo\.png|icon-.*\.png|pdf\.worker\.min\.js)/,
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "app-shell",
                },
            },
            // NOTE: PDFs are NOT cached by Service Worker
            // They are stored in IndexedDB by offline-pdf-store.ts
            // This is intentional for WhatsApp-style offline reliability
            {
                urlPattern: /.*/,
                handler: "NetworkFirst",
                options: {
                    cacheName: "default-cache",
                    networkTimeoutSeconds: 3,
                }
            }
        ]
    })(baseConfig)
    : baseConfig;
