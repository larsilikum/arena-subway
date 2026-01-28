import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    permissions: ['storage', 'theme'],
    web_accessible_resources: [
      { resources: ["fonts/*"], matches: ["*://*/*"]},
      { resources: ["svg/*"], matches: ["*://*/*"]},
      { resources: ["css/*"], matches: ["*://*/*"]},
    ],
  }
});
