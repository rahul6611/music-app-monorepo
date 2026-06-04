import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore, useTheme } from '@music-app/store';
import {
  getClassAssignmentById,
  ensureJitsiRoomForAssignment,
} from '@music-app/firebase';
import type { ClassAssignment } from '@music-app/types';
import ClassContentPanel from '../../components/class/ClassContentPanel';
import JitsiMeetingView from '../../components/class/JitsiMeetingView';
import {
  buildJitsiRoomName,
  buildClassSubject,
  buildJoinMeetingUrl,
  getJitsiServerUrl,
} from '../../utils/jitsi';

export default function LiveClassScreen() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuthStore();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [assignment, setAssignment] = useState<ClassAssignment | null>(null);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(true);
  const [contentOpen, setContentOpen] = useState(isWide);
  const [isRecording, setIsRecording] = useState(false);
  const [joined, setJoined] = useState(false);

  const displayName =
    user?.displayName || user?.email?.split('@')[0] || 'Musiki User';

  useEffect(() => {
    if (!assignmentId || !user) return;

    (async () => {
      try {
        setLoading(true);
        const data = await getClassAssignmentById(assignmentId);
        if (!data) {
          Alert.alert('Not found', 'This class could not be loaded.');
          router.back();
          return;
        }

        const isParticipant =
          data.studentId === user.uid || data.instructorId === user.uid;
        if (!isParticipant) {
          Alert.alert('Access denied', 'You are not enrolled in this class.');
          router.back();
          return;
        }

        const room = data.jitsiRoomName || buildJitsiRoomName(data.id);
        if (!data.jitsiRoomName) {
          await ensureJitsiRoomForAssignment(data.id, room);
          data.jitsiRoomName = room;
        }

        setAssignment(data);
        setRoomName(room);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load class session.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [assignmentId, user, router]);

  const handleHangup = useCallback(() => {
    router.back();
  }, [router]);

  const handleCopyJoinLink = useCallback(async () => {
    if (!roomName) return;

    const joinUrl = buildJoinMeetingUrl(roomName, displayName);
    try {
      await Clipboard.setStringAsync(joinUrl);
      Alert.alert('Copied', 'Join link copied. You can share it now.');
    } catch (error) {
      console.error('Failed to copy join link:', error);
      Alert.alert('Copy failed', `Please copy manually:\n${joinUrl}`);
    }
  }, [roomName]);

  if (loading || !assignment) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Preparing class session…
        </Text>
      </View>
    );
  }

  const subject = buildClassSubject(assignment.classDate, assignment.classTime);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={handleHangup} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={[styles.topBarTitle, { color: theme.text }]} numberOfLines={1}>
            {subject}
          </Text>
          <Text style={[styles.topBarMeta, { color: theme.textSecondary }]} numberOfLines={1}>
            Room: {roomName}
            {joined ? ' · Connected' : ' · Connecting…'}
            {isRecording ? ' · REC' : ''}
          </Text>
        </View>
        <View style={styles.topBarActions}>
          <View
            style={[
              styles.recordStatusChip,
              {
                backgroundColor: isRecording ? '#3A1010' : theme.primarySoft,
                borderColor: isRecording ? '#EF4444' : theme.border,
              },
            ]}
          >
            <MaterialIcons
              name="fiber-manual-record"
              size={14}
              color={isRecording ? '#EF4444' : theme.textSecondary}
            />
            <Text
              style={[
                styles.recordStatusText,
                { color: isRecording ? '#FCA5A5' : theme.textSecondary },
              ]}
            >
              {isRecording ? 'Recording' : 'Not Rec'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCopyJoinLink}
            style={[styles.iconActionBtn, { backgroundColor: theme.primarySoft }]}
            hitSlop={12}
          >
            <MaterialIcons name="content-copy" size={18} color={theme.primary} />
          </TouchableOpacity>
          {!isWide && (
            <TouchableOpacity
              onPress={() => setContentOpen((v) => !v)}
              style={[styles.iconActionBtn, { backgroundColor: theme.primarySoft }]}
            >
              <MaterialIcons name="menu-book" size={20} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <View style={[styles.meetingArea, !isWide && contentOpen && styles.meetingAreaSplit]}>
          <JitsiMeetingView
            roomName={roomName}
            displayName={displayName}
            subject={subject}
            userEmail={user?.email || ''}
            onHangup={handleHangup}
            onJoined={() => setJoined(true)}
            onRecordingChange={setIsRecording}
          />
          {!isWide && !contentOpen && (
            <ClassContentPanel
              assignment={assignment}
              collapsed
              onToggleCollapse={() => setContentOpen(true)}
            />
          )}
        </View>

        {(isWide || contentOpen) && (
          <ClassContentPanel
            assignment={assignment}
            collapsed={false}
            onToggleCollapse={() => setContentOpen(false)}
          />
        )}
      </View>

      {Platform.OS !== 'web' && (
        <Text style={[styles.serverHint, { color: theme.textSecondary }]}>
          Server: {getJitsiServerUrl().replace('https://', '')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { marginTop: 8 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'web' ? 10 : 48,
  },
  backBtn: { padding: 4 },
  topBarCenter: { flex: 1, marginHorizontal: 8 },
  topBarTitle: { fontWeight: '700', fontSize: 16 },
  topBarMeta: { fontSize: 12, marginTop: 2 },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recordStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  iconActionBtn: {
    padding: 8,
    borderRadius: 8,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  meetingArea: {
    flex: 1,
    position: 'relative',
  },
  meetingAreaSplit: {
    flex: 0.55,
  },
  serverHint: {
    fontSize: 10,
    textAlign: 'center',
    padding: 6,
  },
});
