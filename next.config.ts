import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Pin Turbopack root to the directory of this config file. Without this,
// Next.js infers root from the nearest lockfile up the tree and warns when
// it picks a stray ~/package-lock.json over the project's own.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
