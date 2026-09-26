/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Permite un segundo servidor de desarrollo sin pisar .next (ej. NEXT_DIST_DIR=.next-alt)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }] },
};
export default nextConfig;
