/**
 * User Preferences Hook
 * Manages user preferences stored in Azure SQL via backend
 */

import { useState, useEffect, useCallback } from 'react';

export interface UserPreferences {
  tts_speed: number;
  announcement_interval: number;
  priority_mode: 'dynamic' | 'static';
  user_id: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  tts_speed: 1.0,
  announcement_interval: 10,
  priority_mode: 'dynamic',
  user_id: 'default_user',
};

// Backend URL - configured via deployment
const API_BASE_URL = '';

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load preferences from backend
   */
  const loadPreferences = useCallback(async (userId?: string) => {
    try {
      setIsLoading(true);
      const userIdParam = userId || preferences.user_id;
      const url = `${API_BASE_URL}/api/preferences?user_id=${encodeURIComponent(userIdParam)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to load preferences');
      }

      const data = await response.json();
      setPreferences(data);
      setError(null);
      console.log('✅ User preferences loaded:', data);
    } catch (err) {
      console.warn('⚠️ Failed to load preferences, using defaults:', err);
      setPreferences(DEFAULT_PREFERENCES);
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  }, [preferences.user_id]);

  /**
   * Save preferences to backend
   */
  const savePreferences = useCallback(async (newPreferences: Partial<UserPreferences>) => {
    try {
      const updated = { ...preferences, ...newPreferences };
      
      const response = await fetch(`${API_BASE_URL}/api/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      const result = await response.json();
      setPreferences(result.preferences);
      setError(null);
      console.log('✅ User preferences saved:', result.preferences);
      return true;
    } catch (err) {
      console.error('❌ Failed to save preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
      return false;
    }
  }, [preferences]);

  /**
   * Update a single preference
   */
  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      return await savePreferences({ [key]: value });
    },
    [savePreferences]
  );

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    isLoading,
    error,
    updatePreference,
    savePreferences,
    reloadPreferences: loadPreferences,
  };
}
