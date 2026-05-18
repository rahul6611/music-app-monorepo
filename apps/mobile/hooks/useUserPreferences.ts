import { useState, useEffect } from 'react';
import { useAuthStore } from '@music-app/store';
import { fetchUserData } from '@music-app/firebase';
import type { UserPreferences } from '@music-app/types';

export function useUserPreferences() {
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [musicSubStyleTypes, setMusicSubStyleTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPrefs() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchUserData(user.uid);
        if (data) {
          setPreferences(data.preferences || {
            notationSystem: 'hindustani_bhatkhande',
            showBolInHindi: false,
            primaryInstrument: 'Sitar'
          });
          setMusicSubStyleTypes(data.musicSubStyleTypes || []);
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPrefs();
  }, [user]);

  return {
    notationSystem: preferences?.notationSystem || 'hindustani_bhatkhande',
    showBolInHindi: preferences?.showBolInHindi || false,
    primaryInstrument: preferences?.primaryInstrument || 'Sitar',
    musicSubStyleTypes,
    loading
  };
}
