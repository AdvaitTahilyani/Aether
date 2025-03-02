const path = require('path');

/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
  appId: "com.yourdomain.aether",
  productName: "Aether",
  directories: {
    output: "dist-electron",
    buildResources: "build-resources"
  },
  files: [
    "dist/**/*",
    "dist-electron/**/*"
  ],
  mac: {
    category: "public.app-category.productivity",
    target: "dmg"
  },
  win: {
    target: "nsis"
  },
  linux: {
    target: "AppImage"
  }
};

module.exports = config;
