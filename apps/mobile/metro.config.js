const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Expo SDK 52+ detects npm workspaces and configures monorepo resolution
// automatically. Keep this config focused on app-specific customizations.
const config = getDefaultConfig(__dirname);

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

// Wrap with NativeWind — this is REQUIRED for NativeWind v4 to process CSS
module.exports = withNativeWind(config, { 
  input: './global.css',
  darkMode: 'class'
});
