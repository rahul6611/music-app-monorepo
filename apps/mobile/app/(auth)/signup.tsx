import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, ImageBackground } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '@music-app/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';

export default function Signup() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !firstName) {
      setError('First name, email and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`
      });

      await setDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
        email,
        accountType: 'Student',
        musicStyles: [],
        createdAt: new Date().toISOString()
      });

      router.replace('/(tabs)/library');
    } catch (err: any) {
      setError(err.message || 'Error creating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1549493108-05244b7f3001?q=80&w=1587&auto=format&fit=crop' }}
        style={styles.background}
        imageStyle={{ opacity: 0.2 }}
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
                  <Feather name="music" size={35} color="white" />
                </View>
                <Text style={styles.title}>Join Musiki</Text>
                <Text style={styles.tagline}>Start your musical odyssey</Text>
              </View>

              <View style={styles.formContainer}>
                {error ? (
                  <View style={styles.errorBox}>
                    <Feather name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* Name Row */}
                <View style={styles.nameRow}>
                  <View style={[styles.inputWrapper, styles.nameField]}>
                    <TextInput
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="First Name"
                      placeholderTextColor="#6b7280"
                      style={styles.input}
                    />
                  </View>
                  <View style={[styles.inputWrapper, styles.nameField]}>
                    <TextInput
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Last Name"
                      placeholderTextColor="#6b7280"
                      style={styles.input}
                    />
                  </View>
                </View>

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
                    placeholder="Password (min 6 characters)"
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

                {/* Helper Text */}
                <View style={styles.helperBox}>
                   <Feather name="info" size={14} color="#a855f7" />
                   <Text style={styles.helperText}>Your music styles will be set by your instructor.</Text>
                </View>

                <TouchableOpacity
                  onPress={handleSignup}
                  disabled={loading}
                  style={[styles.btn, loading && styles.btnDisabled]}
                >
                  <Text style={styles.btnText}>
                    {loading ? 'Creating Account...' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <Link href="/(auth)/login" asChild>
                    <TouchableOpacity>
                      <Text style={styles.footerLink}>Sign In</Text>
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
    paddingHorizontal: 25,
    paddingVertical: 50,
    justifyContent: 'center',
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
    alignSelf: Platform.OS === 'web' ? 'center' : 'auto',
    width: '100%',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: '#a855f7',
    fontWeight: '600',
    marginTop: 5,
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  nameField: {
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  passwordWrapper: {
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
  },
  eyeIcon: {
    padding: 5,
  },
  helperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  helperText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#a855f7',
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  footerText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLink: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '800',
  },
});
