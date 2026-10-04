const path = require('path');
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
  const projectRoot = __dirname;
  const monorepoRoot = path.resolve(projectRoot, '../..');

  const defaultConfig = await getDefaultConfig(projectRoot);
  const {
    resolver: { sourceExts, assetExts },
  } = defaultConfig;

  return {
    projectRoot,
    watchFolders: [monorepoRoot],
    transformer: {
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
    },
    resolver: {
      ...defaultConfig.resolver,
      assetExts,
      sourceExts: [...sourceExts, 'cjs', 'mjs'],
      nodeModulesPaths: [
        path.resolve(projectRoot, 'node_modules'),
        path.resolve(monorepoRoot, 'node_modules'),
      ],
    },
  };
})();
