/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // transformers.js / onnxruntime-web ships a Node build we must keep out of the
  // browser bundle, and pulls in optional native deps we don't use.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node': false,
      sharp: false,
    };
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
