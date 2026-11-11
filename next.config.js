/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
    // Keep static generation within Cloud Build's available memory.
    cpus: 2,
  },
  async rewrites() {
    // Keep the public Stock Intelligence URL canonical. Cloud Run has served
    // the long-standing physical route reliably across revisions, so route
    // the canonical URL there without exposing the legacy path in navigation.
    return {
      beforeFiles: [
        {
          source: "/admin/prism/stock-intelligence",
          destination: "/admin/prism/stock-exchange",
        },
      ],
    };
  },
};

module.exports = nextConfig;
