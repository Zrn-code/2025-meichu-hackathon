// forge.config.js  (保留 CJS)
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const lifecycle = process.env.npm_lifecycle_event; // 'start' | 'make' | 'package' | 'publish'
const enableFuses = lifecycle !== 'start';

module.exports = {
  packagerConfig: { asar: true },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-squirrel', config: {} },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb', config: {} },
    { name: '@electron-forge/maker-rpm', config: {} },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          { entry: 'src/main.js',   config: 'vite.main.config.mjs',   target: 'main' },
          { entry: 'src/preload.js', config: 'vite.preload.config.mjs', target: 'preload' },
        ],
        renderer: [
          { name: 'main_window',      config: 'vite.renderer.config.mjs' },
          { name: 'avatar_window',    config: 'vite.avatar.config.mjs' },
          { name: 'messagebox_window', config: 'vite.messagebox.config.mjs' }, // ← 統一用全小寫檔名
        ],
      },
    },

    // 只在打包/發佈時啟用 fuses，避免和 start 衝突
    ...(enableFuses ? [
      new FusesPlugin({
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
      }),
    ] : []),
  ],
};
