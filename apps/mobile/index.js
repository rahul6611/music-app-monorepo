// `@expo/metro-runtime` MUST be the first import to ensure Fast Refresh works on web.
import '@expo/metro-runtime';

import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

// This file should only import and register the root.
renderRootComponent(App);
