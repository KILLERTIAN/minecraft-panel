import { google } from "googleapis";
import fs from "fs";
import { config, isGDriveConfigured } from "./config";

function getDrive() {
  if (!isGDriveConfigured()) {
    throw new Error("Google Drive not configured (set GDRIVE_* env vars)");
  }
  const creds = JSON.parse(config.gdriveKey);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export async function uploadFile(
  localPath: string,
  remoteName: string
): Promise<{ id: string; size: number }> {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: {
      name: remoteName,
      parents: [config.gdriveFolderId],
    },
    media: {
      mimeType: "application/zip",
      body: fs.createReadStream(localPath),
    },
    fields: "id,size",
  });
  return {
    id: res.data.id!,
    size: Number(res.data.size || 0),
  };
}

export async function downloadFile(
  fileId: string,
  destPath: string
): Promise<void> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    (res.data as NodeJS.ReadableStream)
      .on("error", reject)
      .pipe(out)
      .on("finish", () => resolve())
      .on("error", reject);
  });
}

export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}

export function driveLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
