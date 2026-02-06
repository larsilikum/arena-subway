import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue','@wxt-dev/auto-icons'],
  manifest: {
    permissions: ['storage', 'webRequest'],
    web_accessible_resources: [
      { resources: ["fonts/*"], matches: ["*://*/*"]},
      { resources: ["svg/*"], matches: ["*://*/*"]},
      { resources: ["css/*"], matches: ["*://*/*"]},
    ],
  },
  autoIcons: {
    baseIconPath: './assets/icon.svg'
  },
});
