import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue','@wxt-dev/auto-icons'],
  manifest: {
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
        id: 'are-na-subweb@lars.ilikum'
      }
    }
  },
  autoIcons: {
    baseIconPath: './assets/icon.svg'
  },
});
