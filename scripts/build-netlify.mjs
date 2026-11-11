import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const projectUrl = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!projectUrl || !publishableKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the Netlify environment before building.");
}

let parsedUrl;
try {
  parsedUrl = new URL(projectUrl);
} catch (error) {
  throw new Error("SUPABASE_URL must be a valid HTTPS project URL.");
}
if (parsedUrl.protocol !== "https:") {
  throw new Error("SUPABASE_URL must use HTTPS.");
}
if (publishableKey.startsWith("sb_secret_") || publishableKey.includes("service_role")) {
  throw new Error("A secret or service_role key cannot be used in the frontend. Use the Supabase publishable key.");
}

const tokenParts = publishableKey.split(".");
if (tokenParts.length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(tokenParts[1], "base64url").toString("utf8"));
    if (payload.role === "service_role") {
      throw new Error("A service_role key cannot be used in the frontend. Use the Supabase publishable key.");
    }
  } catch (error) {
    if (error.message.includes("service_role")) throw error;
  }
}

await mkdir(output, { recursive: true });
await cp(resolve(root, "index.html"), resolve(output, "index.html"));
await cp(resolve(root, "css"), resolve(output, "css"), { recursive: true });
await cp(resolve(root, "js"), resolve(output, "js"), { recursive: true });
await writeFile(
  resolve(output, "js", "supabase-config.js"),
  `export const SUPABASE_URL = ${JSON.stringify(projectUrl)};\nexport const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(publishableKey)};\n`,
  { encoding: "utf8" },
);
console.log("Netlify site files generated in dist/.");
