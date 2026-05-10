import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  webpack: (config, { isServer, webpack }) => {
    // Polyfill Buffer and process — required by @solana/web3.js and Anchor
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };

      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: "process/browser",
        })
      );
    }

    // pino-pretty is an optional dev dependency of @walletconnect/logger
    config.resolve.alias = {
      ...config.resolve.alias,
      "pino-pretty": false,
    };

    return config;
  },
};

export default nextConfig;
