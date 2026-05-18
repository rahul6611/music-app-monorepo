import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@music-app/store';

export default function AuthLayout() {
  const { user, isLoading } = useAuthStore();

  if (!isLoading && user) {
    return <Redirect href="/(tabs)/library" />;
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
