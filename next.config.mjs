/** @type {import('next').NextConfig} */
// Force redeploy: v7 - FETCH-V2 三层fallback
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
