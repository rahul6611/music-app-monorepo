import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, ImageBackground } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@music-app/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)/library');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1514525253344-99a429190281?q=80&w=1464&auto=format&fit=crop' }}
        style={styles.background}
        imageStyle={{ opacity: 0.3 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.headerContainer}>
                <View style={styles.logoCircle}>
                  <Feather name="music" size={40} color="white" />
                </View>
                <Text style={styles.title}>Musiki</Text>
                <Text style={styles.tagline}>Elevate your musical journey</Text>
              </View>

              <View style={styles.formContainer}>
                {error ? (
                  <View style={styles.errorBox}>
                    <Feather name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* Email Field */}
                <View style={styles.inputWrapper}>
                  <Feather name="mail" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email Address"
                    placeholderTextColor="#6b7280"
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                {/* Password Field */}
                <View style={[styles.inputWrapper, styles.passwordWrapper]}>
                  <Feather name="lock" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.forgotPass}>
                  <Text style={styles.forgotPassText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={loading}
                  style={[styles.btn, loading && styles.btnDisabled]}
                >
                  <Text style={styles.btnText}>
                    {loading ? 'Authenticating...' : 'Sign In'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>New to Musiki? </Text>
                  <Link href="/(auth)/signup" asChild>
                    <TouchableOpacity>
                      <Text style={styles.footerLink}>Create Account</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingBottom: 40,
    justifyContent: 'center',
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
    alignSelf: Platform.OS === 'web' ? 'center' : 'auto',
    width: '100%',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: '#a855f7',
    fontWeight: '600',
    marginTop: 5,
    letterSpacing: 0.5,
  },
  formContainer: {
    width: '100%',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 15,
    borderRadius: 16,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 20,
    marginBottom: 20,
    height: 65,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  passwordWrapper: {
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
  },
  eyeIcon: {
    padding: 5,
  },
  forgotPass: {
    alignSelf: 'flex-end',
    marginBottom: 35,
    paddingRight: 5,
  },
  forgotPassText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  btn: {
    backgroundColor: '#a855f7',
    height: 65,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  footerText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  footerLink: {
    color: '#a855f7',
    fontSize: 15,
    fontWeight: '800',
  },
});
