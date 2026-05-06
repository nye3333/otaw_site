import { defineConfig } from "vite";

export default defineConfig({
  base: "/otaw_site/",
  /** Everything here is copied to dist/ root (videos, images, etc.). */
  publicDir: "public",
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        research: "research.html",
        other: "other.html",
        projects: "projects.html",
      },
    },
  },
});
