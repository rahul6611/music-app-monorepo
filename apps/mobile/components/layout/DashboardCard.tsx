import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface DashboardCardProps {
  title: string;
  value: string | number;
  description: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    type: 'positive' | 'negative';
  };
  onPress?: () => void;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  onPress,
}) => {
  const CardContainer = onPress ? Pressable : View;

  return (
    <CardContainer
      onPress={onPress}
      className={`
        bg-zinc-900 border border-zinc-800 rounded-2xl p-6 
        transition-all duration-200 ease-in-out
        ${onPress ? 'active:opacity-80 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5' : ''}
      `}
    >
      <View className="flex-row justify-between items-start mb-4">
        <Text className="text-zinc-400 text-sm font-semibold tracking-wider uppercase">
          {title}
        </Text>
        {icon && <View className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50">{icon}</View>}
      </View>

      <Text className="text-3xl font-extrabold text-white mb-2 tracking-tight">
        {value}
      </Text>

      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-zinc-500 text-xs leading-relaxed max-w-[70%]">
          {description}
        </Text>
        {trend && (
          <Text className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            trend.type === 'positive' 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {trend.value}
          </Text>
        )}
      </View>
    </CardContainer>
  );
};
