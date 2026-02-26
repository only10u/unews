/** @type {import('next').NextConfig} */
// Force redeploy: v6
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
