import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { keycloakify } from "keycloakify/vite-plugin";
import { fileURLToPath, URL } from "node:url";

const themeName = process.env.KEYCLOAK_THEME_NAME ?? "index-replication";

export default defineConfig({
  plugins: [
    react(),
    keycloakify({
      themeName,
      accountThemeImplementation: "none",
      keycloakVersionTargets: {
        "22-to-25": false,
        "all-other-versions": `${themeName}-keycloak-theme.jar`
      }
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../web/src", import.meta.url))
    }
  }
});
