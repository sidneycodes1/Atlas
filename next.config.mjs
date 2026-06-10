/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      '@stripe/crypto': false,
      '@farcaster/mini-app-solana': false,
      '@solana-program/memo': false,
    };
    return config;
  }
};

export default nextConfig;
