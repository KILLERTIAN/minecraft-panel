/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "2gb" },
    proxyClientMaxBodySize: 4 * 1024 * 1024 * 1024, // 4GB
  },
  // Native node modules must stay external (not bundled by Turbopack/webpack).
  serverExternalPackages: [
    "better-sqlite3",
    "dockerode",
    "prismarine-nbt",
    "ws",
    "archiver",
    "googleapis",
    "rcon-client",
  ],
  // Allow Minecraft avatar/skin renders from external services.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "mc-heads.net" },
      { protocol: "https", hostname: "crafatar.com" },
    ],
  },
};

module.exports = nextConfig;
