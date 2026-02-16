import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue','@wxt-dev/auto-icons'],
  manifest: {
    name: "are.na-rail",
    description: "An extension to surf the web like taking a subway. Channels from are.na are used as subway lines.",
    version: "0.1",
    homepage_url: "https://arena-rail.lars.garden",
    manifest_version: 3,
    host_permissions: [
      "https://api.are.na/*",
      "https://dev.are.na/*"
    ],
    permissions: ['storage', 'webRequest', 'identity'],
    web_accessible_resources: [
      { resources: ["fonts/*"], matches: ["*://*/*"]},
      { resources: ["svg/*"], matches: ["*://*/*"]},
      { resources: ["css/*"], matches: ["*://*/*"]},
    ],
    browser_specific_settings: {
      gecko: {
        id: 'are.na-rail@lars.garden'
      }
    }
  },
  autoIcons: {
    baseIconPath: './assets/icon.svg'
  },
});
