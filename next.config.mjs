import withPWA from "next-pwa";

const isProd = process.env.NODE_ENV === "production";

const baseConfig = {
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
    experimental: {
        turbo: {},
        serverComponentsExternalPackages: ["@aws-sdk/*"],
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "Cross-Origin-Opener-Policy",
                        value: "same-origin-allow-popups",
                    },
                ],
            },
        ];
    },
};

// Web build: PWA with Service Worker. The Android app loads the live site
// directly (capacitor.config.json server.url) rather than a bundled static
// export, so there's no separate Capacitor build target here anymore.
export default isProd
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
