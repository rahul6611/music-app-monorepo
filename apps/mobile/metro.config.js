const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the project root and workspace root (for packages)
config.watchFolders = [projectRoot, workspaceRoot];

// Exclude the nested my-expo-app from being watched or scanned
config.resolver.blockList = [
  /my-expo-app\/.*/
];

// Prioritize .mjs files for modern packages like Zustand
config.resolver.sourceExts = ['mjs', 'cjs', ...config.resolver.sourceExts];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'zustand/middleware') {
    // Force resolve to the CJS version to avoid import.meta errors on web/Electron
    try {
      return context.resolveRequest(context, 'zustand/middleware.js', platform);
    } catch (e) {
      return context.resolveRequest(context, 'zustand/esm/middleware.mjs', platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};


// 2. Let Metro know where to look for node_modules (local and hoisted)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Wrap with NativeWind — this is REQUIRED for NativeWind v4 to process CSS
module.exports = withNativeWind(config, { 
  input: './global.css',
  darkMode: 'class'
});
