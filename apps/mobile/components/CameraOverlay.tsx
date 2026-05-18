import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Text, 
  Dimensions, 
  PanResponder, 
  Animated, 
  Alert,
  Platform,
  ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useCameraStore } from '@music-app/store';
import { useTheme } from '@music-app/store';
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PIP_WIDTH = 140;
const PIP_HEIGHT = 200;

export default function CameraOverlay() {
  const { 
    isActive, 
    isMinimized, 
    isRecording, 
    mode, 
    closeCamera, 
    setMinimized, 
    setRecording,
    setCapturedUri 
  } = useCameraStore();
  
  const theme = useTheme();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<CameraView>(null);
  
  const [isDraggable, setIsDraggable] = useState(false);
  const isDraggableRef = useRef(false);
  const dragScale = useRef(new Animated.Value(1)).current;
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  const offsetRef = useRef({ x: SCREEN_WIDTH - PIP_WIDTH - 20, y: SCREEN_HEIGHT - PIP_HEIGHT - 100 });
  const pan = useRef(new Animated.ValueXY(offsetRef.current)).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isMinimized,
      onMoveShouldSetPanResponder: (e, gesture) => {
        return isMinimized && (Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10);
      },
      onPanResponderGrant: (e, gesture) => {
        isDraggableRef.current = false;
        Animated.spring(dragScale, { toValue: 1.03, friction: 3, useNativeDriver: false }).start();

        longPressTimer.current = setTimeout(() => {
          isDraggableRef.current = true;
          setIsDraggable(true);
          Animated.sequence([
            Animated.timing(dragScale, { toValue: 1.1, duration: 150, useNativeDriver: false }),
            Animated.spring(dragScale, { toValue: 1.05, friction: 5, useNativeDriver: false })
          ]).start();
        }, 200);
      },
      onPanResponderMove: (e, gesture) => {
        if (!isMinimized) return;
        if (Math.abs(gesture.dx) > 20 || Math.abs(gesture.dy) > 20) {
          if (!isDraggableRef.current && longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }
        pan.setValue({
          x: offsetRef.current.x + gesture.dx,
          y: offsetRef.current.y + gesture.dy
        });
      },
      onPanResponderRelease: (e, gesture) => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        isDraggableRef.current = false;
        setIsDraggable(false);
        Animated.spring(dragScale, { toValue: 1, friction: 5, useNativeDriver: false }).start();
        const targetX = offsetRef.current.x + gesture.dx;
        const targetY = offsetRef.current.y + gesture.dy;
        const boundedX = Math.max(0, Math.min(SCREEN_WIDTH - PIP_WIDTH, targetX));
        const boundedY = Math.max(0, Math.min(SCREEN_HEIGHT - PIP_HEIGHT, targetY));
        offsetRef.current = { x: boundedX, y: boundedY };
        Animated.spring(pan, { toValue: { x: boundedX, y: boundedY }, useNativeDriver: false, friction: 7, tension: 40 }).start();
      },
      onPanResponderTerminate: () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        setIsDraggable(false);
        isDraggableRef.current = false;
        Animated.spring(dragScale, { toValue: 1, useNativeDriver: false }).start();
      }
    })
  ).current;

  useEffect(() => {
    if (isActive) {
      const requestPermissions = async () => {
        try {
          await requestCameraPermission();
          if (mode === 'video') await requestMicPermission();
        } catch (err) {
          console.error("Permission request error:", err);
        }
      };
      requestPermissions();
    }
  }, [isActive, mode]);

  if (!isActive) return null;

  const handleToggleRecord = async () => {
    if (!cameraRef.current || !isCameraReady || isProcessing) return;

    if (isRecording) {
      try {
        setIsProcessing(true);
        await cameraRef.current.stopRecording();
      } catch (e) {
        console.error("Stop recording failed:", e);
        setRecording(false);
        setIsProcessing(false);
      }
    } else {
      if (mode === 'video') {
        try {
          if (!micPermission?.granted) {
            const res = await requestMicPermission();
            if (!res.granted) {
               Alert.alert("Permission Required", "Microphone permission is needed for video recording.");
               return;
            }
          }
          
          setRecording(true);
          const video = await cameraRef.current.recordAsync({
            maxDuration: 600,
            quality: '720p',
          });
          
          if (video) {
            setCapturedUri(video.uri);
          }
          setRecording(false);
          setIsProcessing(false);
        } catch (error) {
          console.error("Recording error:", error);
          setRecording(false);
          setIsProcessing(false);
        }
      } else {
        try {
          setIsProcessing(true);
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.8,
            skipMetadata: false,
          });
          if (photo) {
            setCapturedUri(photo.uri);
            closeCamera();
          }
          setIsProcessing(false);
        } catch (error) {
          console.error("Photo error:", error);
          setIsProcessing(false);
        }
      }
    }
  };

  const containerStyle = isMinimized ? {
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'absolute',
    zIndex: 9999,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    borderWidth: 2,
    borderColor: isDraggable ? theme.primary : (isRecording ? '#EF4444' : 'rgba(255,255,255,0.4)'),
    transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: dragScale }]
  } : {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 100,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  };

  return (
    <Animated.View collapsable={false} style={[styles.container, containerStyle as any]}>
      {cameraPermission?.granted && (Platform.OS === 'web' || (mode === 'image' || micPermission?.granted)) ? (
        <CameraView
          key={`${mode}-${facing}`}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          mode={mode === 'image' ? 'picture' : 'video'}
          onCameraReady={() => setIsCameraReady(true)}
          facing={facing}
          mute={mode === 'image'}
          autofocus="on"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.permissionPlaceholder]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.permissionText}>Initializing Camera Feed...</Text>
        </View>
      )}
      
      {isMinimized && <View {...panResponder.panHandlers} style={StyleSheet.absoluteFill} pointerEvents="auto" />}

      <View style={[StyleSheet.absoluteFill, styles.overlay, isMinimized && styles.overlayMini]} pointerEvents="box-none">
        {isMinimized ? (
          <View style={styles.miniTopActions}>
            <TouchableOpacity onPress={closeCamera} style={styles.miniIconWrapper}>
              <Ionicons name="close" size={16} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFacing(prev => prev === 'front' ? 'back' : 'front')} style={styles.miniIconWrapper}>
              <Ionicons name="camera-reverse" size={14} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMinimized(false)} style={styles.miniIconWrapper}>
              <Ionicons name="expand" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => setMinimized(true)} style={styles.iconButton}>
              <Ionicons name="contract" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.topRightActions}>
              <TouchableOpacity onPress={() => setFacing(prev => prev === 'front' ? 'back' : 'front')} style={[styles.iconButton, { marginRight: 12 }]}>
                <Ionicons name="camera-reverse" size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={closeCamera} style={styles.iconButton}>
                <Ionicons name="close" size={26} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isRecording && (
          <View style={[styles.timerContainer, isMinimized && styles.timerContainerMini]}>
            <View style={styles.redDot} />
            <Text style={styles.timerText}>{isMinimized ? "REC" : "Recording..."}</Text>
          </View>
        )}

        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}

        {!isMinimized ? (
          <View style={styles.bottomControls}>
            <TouchableOpacity 
              onPress={handleToggleRecord}
              disabled={isProcessing}
              style={[styles.recordButton, isRecording && styles.recordingActive]}
            >
              <View style={[styles.recordButtonInner, isRecording && styles.recordingActiveInner]} />
            </TouchableOpacity>
            <Text style={styles.hintText}>
              {mode === 'video' ? (isRecording ? "Tap to stop" : "Tap to record video") : "Tap to take photo"}
            </Text>
          </View>
        ) : (
          <View style={styles.miniBottomArea}>
            {isRecording && (
              <TouchableOpacity onPress={handleToggleRecord} disabled={isProcessing} style={styles.miniStopButton}>
                <Ionicons name="stop" size={14} color="#FFF" />
                <Text style={styles.miniStopLabel}>STOP</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', padding: 16, justifyContent: 'space-between' },
  overlayMini: { padding: 8 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Platform.OS === 'ios' ? 50 : 20 },
  miniTopActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniIconWrapper: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  topRightActions: { flexDirection: 'row' },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  bottomControls: { alignItems: 'center', marginBottom: 50 },
  recordButton: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  recordingActive: { borderColor: 'rgba(255,255,255,0.7)' },
  recordButtonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EF4444' },
  recordingActiveInner: { width: 30, height: 30, borderRadius: 6 },
  timerContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 130 : 90, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  timerContainerMini: { top: 45 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 6, shadowColor: '#EF4444', shadowRadius: 4, shadowOpacity: 0.8 },
  timerText: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.5, textShadowColor: '#000', textShadowRadius: 4 },
  hintText: { color: '#FFF', fontSize: 14, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  miniBottomArea: { alignItems: 'center' },
  miniStopButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4, elevation: 5 },
  miniStopLabel: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  permissionPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  permissionText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  processingText: { color: '#FFF', marginTop: 10, fontWeight: '700' }
});
