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
      extraNodeModules: new Proxy(
        {},
        {
          get: (target, name) => {
            if (target[name]) return target[name];
            const localPath = path.join(projectRoot, 'node_modules', name);
            if (require('fs').existsSync(localPath)) return localPath;
            return path.join(monorepoRoot, 'node_modules', name);
          },
        }
      ),
      nodeModulesPaths: [
        path.resolve(projectRoot, 'node_modules'),
        path.resolve(monorepoRoot, 'node_modules'),
      ],
    },
  };
})();
