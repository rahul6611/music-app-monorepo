import React from 'react';
import { View, Text, useWindowDimensions, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Sidebar } from './Sidebar';

interface SidebarItem {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

interface ResponsiveDashboardLayoutProps {
  children: React.ReactNode;
  navItems: SidebarItem[];
  activeNavId: string;
  onNavSelect: (id: string) => void;
  title: string;
  onLogout?: () => void;
}

export const ResponsiveDashboardLayout: React.FC<ResponsiveDashboardLayoutProps> = ({
  children,
  navItems,
  activeNavId,
  onNavSelect,
  title,
  onLogout,
}) => {
  const { width } = useWindowDimensions();
  
  // 768px is the standard md (medium) tailwind responsive breakpoint
  const isDesktop = width >= 768;

  return (
    <View className="flex-1 bg-black">
      {isDesktop ? (
        /* --- DESKTOP VIEWPORT LAYOUT --- */
        <View className="flex-1 flex-row h-full">
          {/* Sidebar Navigation */}
          <Sidebar
            items={navItems}
            activeId={activeNavId}
            onSelect={onNavSelect}
            onLogout={onLogout}
          />
          
          {/* Scrollable Main Area */}
          <View className="flex-1 flex-col h-full bg-zinc-950">
            {/* Top Bar for Desktop Dashboard */}
            <View className="h-16 border-b border-zinc-900 bg-zinc-950/80 px-8 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-white tracking-tight">
                {title}
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

            {/* Dashboard Content Container */}
            <View className="flex-1">
              {children}
            </View>
          </View>
        </View>
      ) : (
        /* --- MOBILE VIEWPORT LAYOUT --- */
        <View className="flex-1 flex-col h-full justify-between bg-zinc-950">
          
          {/* Mobile Top Header */}
          <View className="h-16 px-6 border-b border-zinc-900 bg-zinc-950 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-lg bg-purple-600 items-center justify-center">
                <Feather name="music" size={16} color="white" />
              </View>
              <Text className="text-lg font-black text-white tracking-tighter">
                Musiki
              </Text>
            </View>
            
            <Text className="text-zinc-300 font-bold text-sm">
              {title}
            </Text>

            <Pressable className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:opacity-60">
              <Feather name="user" size={14} color="#a855f7" />
            </Pressable>
          </View>

          {/* Core App View */}
          <View className="flex-1">
            {children}
          </View>

          {/* Mobile Bottom Tab-Bar panel */}
          <View className="h-20 border-t border-zinc-900 bg-zinc-950/95 px-4 flex-row justify-around items-center pb-2">
            {navItems.map((item) => {
              const isActive = item.id === activeNavId;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onNavSelect(item.id)}
                  className="flex-col items-center py-1 px-3 active:opacity-50"
                >
                  <View className={`p-1 rounded-lg ${isActive ? 'bg-purple-600/10' : 'bg-transparent'}`}>
                    <Feather 
                      name={item.icon} 
                      size={20} 
                      color={isActive ? '#c084fc' : '#6b7280'} 
                    />
                  </View>
                  <Text className={`text-[10px] mt-1 font-bold ${isActive ? 'text-purple-400' : 'text-zinc-500'}`}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};
