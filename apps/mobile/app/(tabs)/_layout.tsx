import { Tabs, Redirect, Slot, usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { View, Platform, useWindowDimensions, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@music-app/store';
import { useEffect, useState } from 'react';
import { fetchUserData } from '@music-app/firebase';
import { useTheme } from '@music-app/store';
import { Sidebar } from '../../components/layout/Sidebar';
import { signOut } from 'firebase/auth';
import { auth } from '@music-app/firebase';

export default function TabsLayout() {
  const { user, isLoading } = useAuthStore();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [accountType, setAccountType] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserData(user.uid).then(data => {
        if (data) setAccountType(data.accountType);
      });
    }
  }, [user]);

  if (!isLoading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  const navItems = [
    { id: 'library', label: 'Library', icon: 'layers' as const },
    { id: 'modules', label: 'Modules', icon: 'book' as const },
    { id: 'students', label: 'Students', icon: 'users' as const },
    { id: 'community', label: 'Community', icon: 'message-circle' as const },
    { id: 'profile', label: 'Profile', icon: 'user' as const },
  ];

  const getActiveTab = () => {
    if (pathname.includes('/library')) return 'library';
    if (pathname.includes('/modules')) return 'modules';
    if (pathname.includes('/students')) return 'students';
    if (pathname.includes('/community')) return 'community';
    if (pathname.includes('/profile')) return 'profile';
    return 'library';
  };

  const activeTab = getActiveTab();

  const handleNavSelect = (id: string) => {
    router.push(`/(tabs)/${id}`);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (e) {
      console.error(e);
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'library': return 'Musiki Library';
      case 'modules': return 'Learning Modules';
      case 'students': return accountType === 'Instructor' ? 'Students' : 'Class';
      case 'community': return 'Community Feed';
      case 'profile': return 'My Profile';
      default: return 'Dashboard';
    }
  };

  const isDesktop = width >= 768;

  if (isDesktop) {
    return (
      <View className="flex-1 flex-row h-full bg-zinc-950">
        <Sidebar
          items={navItems}
          activeId={activeTab}
          onSelect={handleNavSelect}
          userEmail={user?.email || 'rahul@musiki.com'}
          onLogout={handleLogout}
        />
        
        <View className="flex-1 flex-col h-full bg-zinc-950">
          {/* Top Bar for Desktop */}
          <View className="h-16 border-b border-zinc-900 bg-zinc-950/80 px-8 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-white tracking-tight">
              {getHeaderTitle()}
            </Text>
            <View className="flex-row items-center space-x-4">
              <Pressable className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center hover:bg-zinc-800 active:opacity-70">
                <Feather name="bell" size={16} color="#9ca3af" />
              </Pressable>
              <Pressable className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center hover:bg-zinc-800 active:opacity-70">
                <Feather name="settings" size={16} color="#9ca3af" />
              </Pressable>
            </View>
          </View>

          {/* Slot content */}
          <View className="flex-1">
            <Slot />
          </View>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { 
          backgroundColor: theme.background === '#000000' ? '#121212' : '#FFFFFF', 
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
        headerTitleStyle: { color: theme.text, fontWeight: 'bold' },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: Platform.OS === 'ios' ? 88 : 65 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? 28 : Math.max(insets.bottom, 8),
          paddingTop: 10,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="library"
        options={{
          headerTitle: 'Musiki Library',
          tabBarLabel: 'Library',
          tabBarIcon: ({ color }) => <Feather name="layers" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="modules"
        options={{
          headerTitle: 'Learning Modules',
          tabBarLabel: 'Modules',
          tabBarIcon: ({ color }) => <Feather name="book" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          headerTitle: accountType === 'Instructor' ? 'Students' : 'Class',
          tabBarLabel: accountType === 'Instructor' ? 'Students' : 'Class',
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          headerShown: false,
          tabBarLabel: 'Community',
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: 'My Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
