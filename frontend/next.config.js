const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
const normalizedApiUrl = apiUrl.replace(/\/api\/v1\/?$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${normalizedApiUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
