/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config, { isServer }) => {
    // Work around a Next/SWC transform collision in `lru-cache` when it is
    // compiled as a client module (duplicate `_delete` identifier).
    if (!isServer) {
      const lruCacheEntry = require.resolve('lru-cache')
      const lruCacheRoot = path.resolve(path.dirname(lruCacheEntry), '..', '..')
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'lru-cache': path.join(lruCacheRoot, 'dist/esm/index.min.js'),
      }
    }

    return config
  },
}

module.exports = nextConfig
