import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./ui", import.meta.url)),
  build: { outDir: "../dist/ui", emptyOutDir: true },
});
