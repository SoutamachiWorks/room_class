import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Font eksternal
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 tahun
          },
        },
      },
      {
        // Aset statis UI Kit (JS, CSS) Next.js
        urlPattern: /\/_next\/static\/.+$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 hari
          },
        },
      },
      {
        // Media (Gambar Soal dari R2, Ikon, dll)
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-image-assets',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 hari
          },
        },
      },
      {
        // Media yang sudah dioptimasi oleh Next.js
        urlPattern: /\/_next\/image\?url=.+$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-image',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 hari
          },
        },
      },
      // NOTE:
      // Do not cache authenticated API responses in service worker.
      // It can leak stale/private data across user sessions on shared devices.
    ]
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the Dev environment origins from the local loopback and WiFi IP address so CORS blocks don't kill auth fetches
  allowedDevOrigins: [
    '127.0.0.1',
    '192.168.1.6',
    '192.168.1.7',
    'localhost',
    '172.16.0.2',
    'flop-sulphuric-aftermost.ngrok-free.dev',
    'slow-falcons-double.loca.lt'
  ],
  // Fix Next.js 16 Turbopack error when using next-pwa (which modifies webpack config internally)
  turbopack: {},
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return [];
    }

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https:",
      "media-src 'self' https:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
