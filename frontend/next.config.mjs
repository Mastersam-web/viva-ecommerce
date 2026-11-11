/** @type {import('next').NextConfig} */
const API = process.env.API_URL || 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Le navigateur parle uniquement à Next.js (même origine) : cookies httpOnly + pas de CORS.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API}/uploads/:path*` },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ] }];
  },
};
export default nextConfig;
