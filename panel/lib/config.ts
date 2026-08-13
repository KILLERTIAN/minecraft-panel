// Central env config. Validated lazily so the build never crashes on missing
// runtime secrets.

export const config = {
  adminPassword: process.env.ADMIN_PASSWORD || "changeme",
  jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me",

  mcContainer: process.env.MC_CONTAINER || "mc",
  rconHost: process.env.RCON_HOST || "localhost",
  rconPort: parseInt(process.env.RCON_PORT || "25575", 10),
  rconPassword: process.env.RCON_PASSWORD || "minecraft",

  // Path inside the panel container where the mc-data volume is mounted.
  mcDataPath: process.env.MC_DATA_PATH || "/mc-data",
  worldName: process.env.WORLD_NAME || "world",

  serverAddress: process.env.SERVER_ADDRESS || "localhost:25565",
  bedrockPort: parseInt(process.env.BEDROCK_PORT || "19132", 10),

  gdriveKey: process.env.GDRIVE_SERVICE_ACCOUNT_KEY || "",
  gdriveFolderId: process.env.GDRIVE_FOLDER_ID || "",

  dataDir: process.env.PANEL_DATA_DIR || "./data",
  backupSchedule: process.env.BACKUP_SCHEDULE || "", // e.g. "0 */6 * * *", empty = off
  backupRetentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || "7", 10),
} as const;

export function isGDriveConfigured(): boolean {
  return Boolean(config.gdriveKey && config.gdriveFolderId);
}
