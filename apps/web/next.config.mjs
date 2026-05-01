/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode catches double-invocation bugs in dev
  reactStrictMode: true,

  // Allow backend API images if we add them later
  images: {
    remotePatterns: [],
  },

  // Env validation: fail fast at build time if required vars are missing
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
