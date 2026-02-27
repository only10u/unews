/** @type {import('next').NextConfig} */
// Force redeploy: v16 - real image enrichment + R2 transfer
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
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]
  },
}

export default nextConfig
