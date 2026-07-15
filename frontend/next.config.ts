import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Fail fast if the environment file is missing (mirrors the backend check in
// app/main.py). Next.js loads frontend/.env automatically, but a missing file
// almost always means it was never created — surface that clearly instead of
// silently falling back to defaults. Evaluated on `next dev` / `build` / `start`.
const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  throw new Error(
    `Missing environment file: ${envPath}\n` +
      "Copy frontend/.env.example to frontend/.env (or run `make env`).",
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
