/** @type {import('next').NextConfig} */
// Force redeploy: v8 - FETCH-V3 话题页og:image + TopHub
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
