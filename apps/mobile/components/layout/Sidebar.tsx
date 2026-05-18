import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface SidebarItem {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

interface SidebarProps {
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  userEmail?: string;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeId,
  onSelect,
  userEmail = 'rahul@musiki.com',
  onLogout,
}) => {
  return (
    <View className="w-64 bg-zinc-950 border-r border-zinc-900 h-full py-6 px-4 flex-col justify-between">
      <View>
        {/* Logo and Brand Title */}
        <View className="flex-row items-center space-x-3 px-3 mb-8">
          <View className="w-10 h-10 rounded-xl bg-purple-600 items-center justify-center shadow-lg shadow-purple-600/30">
            <Feather name="music" size={20} color="white" />
          </View>
          <Text className="text-xl font-extrabold text-white tracking-tight">
            Musiki
          </Text>
        </View>

        {/* Navigation Items list */}
        <Text className="text-zinc-500 text-xxs font-bold uppercase tracking-widest px-3 mb-4">
          Navigation
        </Text>
        
        <ScrollView showsVerticalScrollIndicator={false} className="space-y-1">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                className={`
                  flex-row items-center px-4 py-3 rounded-xl mb-1.5
                  transition-all duration-150 ease-in-out
                  ${isActive 
                    ? 'bg-purple-600/10 border border-purple-500/20 text-purple-400' 
                    : 'bg-transparent border border-transparent text-zinc-400 active:bg-zinc-900 hover:bg-zinc-900/50'
                  }
                `}
              >
                <Feather 
                  name={item.icon} 
                  size={18} 
                  color={isActive ? '#c084fc' : '#9ca3af'} 
                  className="mr-3"
                />
                <Text className={`font-semibold text-sm ${isActive ? 'text-purple-400' : 'text-zinc-300'}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* User Session profile panel */}
      <View className="border-t border-zinc-900 pt-6">
        <View className="flex-row items-center space-x-3 px-3 mb-4">
          <View className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 items-center justify-center">
            <Feather name="user" size={16} color="#a855f7" />
          </View>
          <View className="flex-1 overflow-hidden">
            <Text className="text-white text-xs font-bold truncate">
              Rahul Vekariya
            </Text>
            <Text className="text-zinc-500 text-xxs truncate">
              {userEmail}
            </Text>
          </View>
        </View>

        {onLogout && (
          <Pressable
            onPress={onLogout}
            className="flex-row items-center px-4 py-3 rounded-xl bg-zinc-900/40 border border-zinc-850 hover:bg-red-950/20 hover:border-red-900/30 group"
          >
            <Feather name="log-out" size={16} color="#9ca3af" className="mr-3 group-hover:text-red-400" />
            <Text className="text-zinc-300 text-xs font-semibold group-hover:text-red-400">
              Sign Out Session
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};
