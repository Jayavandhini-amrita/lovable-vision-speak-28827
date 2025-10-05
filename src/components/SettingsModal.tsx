/**
 * Settings Modal Component
 * Allows users to configure TTS speed, announcement interval, and priority mode
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { UserPreferences } from '@/hooks/useUserPreferences';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSave: (prefs: Partial<UserPreferences>) => Promise<boolean>;
}

export const SettingsModal = ({ isOpen, onClose, preferences, onSave }: SettingsModalProps) => {
  const [ttsSpeed, setTtsSpeed] = useState(preferences.tts_speed);
  const [announcementInterval, setAnnouncementInterval] = useState(preferences.announcement_interval);
  const [priorityMode, setPriorityMode] = useState(preferences.priority_mode);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTtsSpeed(preferences.tts_speed);
    setAnnouncementInterval(preferences.announcement_interval);
    setPriorityMode(preferences.priority_mode);
  }, [preferences]);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onSave({
      tts_speed: ttsSpeed,
      announcement_interval: announcementInterval,
      priority_mode: priorityMode,
    });
    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* TTS Speed */}
        <div className="space-y-2">
          <Label htmlFor="tts-speed" className="text-sm font-medium">
            TTS Speed: {ttsSpeed.toFixed(1)}x
          </Label>
          <Slider
            id="tts-speed"
            min={0.5}
            max={2.0}
            step={0.1}
            value={[ttsSpeed]}
            onValueChange={(value) => setTtsSpeed(value[0])}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Adjust speech synthesis speed (0.5x - 2.0x)
          </p>
        </div>

        {/* Announcement Interval */}
        <div className="space-y-2">
          <Label htmlFor="interval" className="text-sm font-medium">
            Announcement Interval: {announcementInterval}s
          </Label>
          <Slider
            id="interval"
            min={5}
            max={30}
            step={1}
            value={[announcementInterval]}
            onValueChange={(value) => setAnnouncementInterval(value[0])}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Time between repeated announcements of the same object
          </p>
        </div>

        {/* Priority Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Priority Mode</Label>
          <div className="flex gap-2">
            <Button
              variant={priorityMode === 'dynamic' ? 'default' : 'outline'}
              onClick={() => setPriorityMode('dynamic')}
              className="flex-1"
            >
              Dynamic
            </Button>
            <Button
              variant={priorityMode === 'static' ? 'default' : 'outline'}
              onClick={() => setPriorityMode('static')}
              className="flex-1"
            >
              Static
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {priorityMode === 'dynamic' 
              ? 'Adjusts priority based on object size and approach' 
              : 'Fixed priority for all detections'}
          </p>
        </div>

        {/* Save Button */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 ai-button primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};
