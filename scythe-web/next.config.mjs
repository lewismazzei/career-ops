/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
