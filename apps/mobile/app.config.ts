import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Ensures apps/mobile/.env is loaded when Expo evaluates config (monorepo-safe).
 * EXPO_PUBLIC_* vars are still inlined at bundle time — restart Metro after .env edits.
 */
export default ({ config }: ConfigContext): ExpoConfig => config;
