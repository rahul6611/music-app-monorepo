/**
 * Windows autolinking overrides for react-native-windows (new architecture).
 *
 * Legacy .sln files shipped with some community modules (e.g. react-native-screens)
 * reference Microsoft.ReactNative.vcxproj directly, which forces a source build with
 * an unresolved $(Platform) and breaks linking (win10- Bootstrap.lib path).
 */
module.exports = {
  dependencies: {
    '@react-native-async-storage/async-storage': {
      platforms: {
        windows: null,
      },
    },
    'react-native-screens': {
      platforms: {
        windows: null,
      },
    },
    'react-native-webview': {
      platforms: {
        windows: null,
      },
    },
    '@react-native-community/datetimepicker': {
      platforms: {
        windows: null,
      },
    },
    'react-native-reanimated': {
      platforms: {
        windows: null,
      },
    },
    'react-native-worklets': {
      platforms: {
        windows: null,
      },
    },
  },
};
