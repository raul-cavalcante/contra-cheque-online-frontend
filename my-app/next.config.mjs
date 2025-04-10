/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['example.com'], // Substitua por domínios permitidos para imagens
  },
  experimental: {
    appDir: true,
  },
};

export default nextConfig;
