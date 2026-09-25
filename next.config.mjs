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
        unoptimized: isCapacitor, // next/image's optimizer needs a server — required for static export
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
        // This dev machine is memory-constrained (often well under 2GB free
        // RAM — see CLAUDE.md). By default `next build`'s static-page-
        // generation phase spawns one worker PROCESS per CPU core, each
        // loading its own copy of the whole build graph — on a low-memory
        // machine that's exactly what crashes the build with a raw native
        // access violation (exit code 3221226505 / 0xC0000005) rather than
        // a normal JS error. Forcing this down to 1 makes prerendering
        // fully sequential (slower, but it only needs one worker's worth
        // of memory instead of several at once) so the build actually
        // completes here instead of crashing partway through.
        cpus: 1,
        workerThreads: false,
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
                    // No framing by other sites (clickjacking on the admin
                    // portal). 'self', not 'none': the admin "View PDF"
                    // dialog iframes same-origin content.
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
                ],
            },
        ];
    },
};

// Capacitor build: static export, bundled locally into the Android app so
// its entry shell (landing page, login, offline dashboard, PDF
// viewer/present) works with zero network — see scripts/build-capacitor.js
// for why and what gets excluded. No PWA/Service Worker here: a real local
// bundle doesn't need a SW-based offline fallback.
if (isCapacitor) {
    baseConfig.output = 'export';
    baseConfig.trailingSlash = true; // Better for file-based routing
}

// Web build: PWA with Service Worker, deployed to Vercel — this is also
// what the Android app's *authenticated* session runs against once a rep
// logs in online (src/app/page.tsx jumps to https://spicasg.in from the
// locally-bundled landing page), so it still gets instant content updates
// with no APK rebuild needed for that part of the flow.
export default isProd && !isCapacitor
    ? withPWA({
        dest: "public",
        register: true,
        skipWaiting: false, // Changed to false - allow user to control updates
        disable: false,

        fallbacks: {
            document: "/offline.html",
        },

        // Function matchers, not regexes: Workbox tests a RegExp against the
        // FULL url (https://spicasg.in/...), so the old /^\/_next/ pattern
        // never matched and everything fell through to an unbounded
        // catch-all cache — including PDFs, /api responses and cross-origin
        // Firebase traffic.
        runtimeCaching: [
            {
                // Content-hashed build assets: safe to cache forever, and keeping
                // them means a cached older page can still load its own chunks.
                urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"),
                handler: "CacheFirst",
                options: {
                    cacheName: "next-static",
                    expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
                },
            },
            {
                urlPattern: ({ url }) =>
                    url.origin === self.location.origin &&
                    /^\/(favicon\.ico|manifest\.json|logo\.png|icon-.*\.png|pdf\.worker\.min\.m?js)$/.test(url.pathname),
                handler: "StaleWhileRevalidate",
                options: { cacheName: "app-shell" },
            },
            // Never cache: API routes, and anything cross-origin (Firestore,
            // Auth, R2 PDFs). Offline PDFs live in IndexedDB via
            // offline-pdf-store.ts, not in the Service Worker cache.
            {
                urlPattern: ({ url }) => url.origin !== self.location.origin || url.pathname.startsWith("/api/"),
                handler: "NetworkOnly",
                // next-pwa's fallback wiring reads `options` on every entry.
                options: {},
            },
            {
                urlPattern: /.*/,
                handler: "NetworkFirst",
                options: {
                    cacheName: "default-cache",
                    networkTimeoutSeconds: 5,
                    expiration: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 },
                },
            },
        ]
    })(baseConfig)
    : baseConfig;
