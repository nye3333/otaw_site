import { defineConfig } from "vite";

export default defineConfig({
  base: "/otaw_site/",
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
