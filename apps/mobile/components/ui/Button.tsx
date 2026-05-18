import React from 'react';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  icon,
}) => {
  // Styles based on variant
  const variantStyles = {
    primary: 'bg-purple-600 active:bg-purple-700 hover:bg-purple-500 border-transparent',
    secondary: 'bg-zinc-800 active:bg-zinc-900 hover:bg-zinc-700 border-transparent',
    outline: 'bg-transparent border-zinc-700 active:bg-zinc-900 hover:bg-zinc-900',
    danger: 'bg-red-600 active:bg-red-700 hover:bg-red-500 border-transparent',
  };

  const textStyles = {
    primary: 'text-white font-semibold',
    secondary: 'text-zinc-200 font-semibold',
    outline: 'text-zinc-300 font-semibold',
    danger: 'text-white font-semibold',
  };

  // Styles based on size
  const sizeStyles = {
    sm: 'py-2 px-4 rounded-lg text-sm',
    md: 'py-3 px-6 rounded-xl text-base',
    lg: 'py-4 px-8 rounded-2xl text-lg',
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`
        flex-row items-center justify-center border
        transition-all duration-200 ease-in-out
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${isDisabled ? 'opacity-50' : 'opacity-100'}
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? '#a855f7' : '#ffffff'} size="small" className="mr-2" />
      ) : icon ? (
        <View className="mr-2">{icon}</View>
      ) : null}
      
      <Text className={`${textStyles[variant]} text-center`}>
        {label}
      </Text>
    </Pressable>
  );
};
