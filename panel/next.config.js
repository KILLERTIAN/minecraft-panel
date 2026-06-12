/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Type-checking runs locally before commits; in-container tsc OOM-kills
  // the 8GB VPS during Coolify builds (no swap), so skip it here.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
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
