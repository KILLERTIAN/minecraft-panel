import { SignJWT, jwtVerify } from "jose";
import { config } from "./config";

const COOKIE = "mcpanel_session";
const ALG = "HS256";

function secret(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret);
}

export async function createToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret());
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret(), { algorithms: [ALG] });
    return true;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = COOKIE;
