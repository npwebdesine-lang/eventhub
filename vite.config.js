import { defineConfig } from "vite";

// Split the large, rarely-changing vendor libraries into their own chunks so a
// code change to the app doesn't bust the cache for React/router/Supabase/GSAP.
// (JSX is handled by Vite's default esbuild transform; no extra plugin needed.)
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("gsap")) return "gsap";
          if (
            id.includes("react-router") ||
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("/scheduler/")
          )
            return "react-vendor";
        },
      },
    },
  },
});
