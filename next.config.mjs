/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    instrumentationHook: false,
  },
  async rewrites() {
    return {
      // Serve the offline-ready report bundle (public/app.html) at the site root.
      beforeFiles: [{ source: '/', destination: '/app.html' }],
      afterFiles: [],
      fallback: [],
    }
  },
  async headers() {
    const baseline = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]

    return [
      {
        source: '/:path*',
        headers: baseline,
      },
      {
        // The service worker must be revalidated on every load and scoped to the whole site.
        source: '/sw.js',
        headers: [
          ...baseline,
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [...baseline, { key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
      {
        // Evidence images in this bundle are immutable.
        source: '/images/:path*',
        headers: [...baseline, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
