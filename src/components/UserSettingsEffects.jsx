import { useEffect, useRef } from 'react';
import { getStudentPendingActivities } from '../services/studentApi';
import { useUserSettings } from '../hooks/useUserSettings';

const getNotificationKey = (userId, activityId) => {
  const today = new Date().toISOString().slice(0, 10);
  return `elikha_due_notification_${userId}_${activityId}_${today}`;
};

const playClickSound = (audioContextRef) => {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  const ctx = audioContextRef.current || new AudioContextCtor();
  audioContextRef.current = ctx;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(720, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.045);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.08);
};

const startAmbientMusic = (audioContextRef, ambientRef) => {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor || ambientRef.current) return;

  const ctx = audioContextRef.current || new AudioContextCtor();
  audioContextRef.current = ctx;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.018, ctx.currentTime);
  gain.connect(ctx.destination);

  const oscillatorA = ctx.createOscillator();
  const oscillatorB = ctx.createOscillator();
  oscillatorA.type = 'sine';
  oscillatorB.type = 'triangle';
  oscillatorA.frequency.setValueAtTime(261.63, ctx.currentTime);
  oscillatorB.frequency.setValueAtTime(392, ctx.currentTime);
  oscillatorA.connect(gain);
  oscillatorB.connect(gain);
  oscillatorA.start();
  oscillatorB.start();

  let step = 0;
  const notes = [261.63, 293.66, 329.63, 392, 329.63, 293.66];
  const interval = window.setInterval(() => {
    const now = ctx.currentTime;
    const note = notes[step % notes.length];
    oscillatorA.frequency.setTargetAtTime(note, now, 0.08);
    oscillatorB.frequency.setTargetAtTime(note * 1.5, now, 0.08);
    step += 1;
  }, 1800);

  ambientRef.current = {
    stop: () => {
      window.clearInterval(interval);
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      window.setTimeout(() => {
        try {
          oscillatorA.stop();
          oscillatorB.stop();
          oscillatorA.disconnect();
          oscillatorB.disconnect();
          gain.disconnect();
        } catch {
          // Already stopped.
        }
      }, 260);
      ambientRef.current = null;
    },
  };
};

const stopAmbientMusic = (ambientRef) => {
  if (ambientRef.current) {
    ambientRef.current.stop();
  }
};

export default function UserSettingsEffects() {
  const { settings, userId } = useUserSettings();
  const audioContextRef = useRef(null);
  const ambientRef = useRef(null);
  const latestSettingsRef = useRef(settings);

  useEffect(() => {
    latestSettingsRef.current = settings;
    document.documentElement.dataset.elikhaDataSaver = settings.dataSaver ? 'true' : 'false';
    document.documentElement.dataset.elikhaQuality = settings.quality;

    if (!settings.backgroundMusic) {
      stopAmbientMusic(ambientRef);
    }
  }, [settings]);

  useEffect(() => {
    const handleFirstInteraction = () => {
      if (latestSettingsRef.current.backgroundMusic) {
        startAmbientMusic(audioContextRef, ambientRef);
      }
    };

    const handleClick = (event) => {
      const target = event.target;
      const clickable = target?.closest?.('button, a, input, select, textarea, [role="button"]');
      if (!clickable) return;

      if (latestSettingsRef.current.soundEffects) {
        playClickSound(audioContextRef);
      }
      if (latestSettingsRef.current.backgroundMusic) {
        startAmbientMusic(audioContextRef, ambientRef);
      }
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('click', handleClick, true);
      stopAmbientMusic(ambientRef);
    };
  }, []);

  useEffect(() => {
    const maybeNotifyDueActivity = async () => {
      if (!settings.notifications || !userId || typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;

      const userInfo = JSON.parse(window.sessionStorage.getItem('userInfo') || '{}');
      if (String(userInfo.role || '').toLowerCase() !== 'student') return;

      const result = await getStudentPendingActivities(userId);
      if (!result.success) return;

      const now = new Date();
      const dueSoon = (result.data || []).find((activity) => {
        if (!activity.due_date) return false;
        const due = new Date(activity.due_date);
        if (Number.isNaN(due.getTime())) return false;
        const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 1;
      });

      if (!dueSoon) return;
      const key = getNotificationKey(userId, dueSoon.id);
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, 'sent');

      new Notification('E-Likha activity reminder', {
        body: `${dueSoon.title || 'An activity'} is due soon.`,
      });
    };

    maybeNotifyDueActivity();
  }, [settings.notifications, userId]);

  return null;
}
