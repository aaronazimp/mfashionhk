/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  },
  async rewrites() {
    return [];
  },
  // Some third-party packages ship ESM that Turbopack may not transpile
  // automatically. Ensure these are transpiled so client chunks don't
  // contain raw `import` statements that break in the browser.
  transpilePackages: [
    'lucide-react',
    'date-fns',
    '@supabase/supabase-js'
  ],
}

export default nextConfig
