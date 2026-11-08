import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hashPin, verifyPin } from '../auth/pin';
import { initDatabase, getSettings, setSetting } from '../db/database';
import {
  createAdminProfile,
  getAdminProfile,
  setAdminPin,
} from '../db/repositories';

export type AppStatus = 'loading' | 'setup' | 'locked' | 'unlocked';

interface AppContextValue {
  status: AppStatus;
  adminName: string;
  settings: Record<string, string>;
  error: string | null;
  setup: (name: string, pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  changePin: (currentPin: string, nextPin: string) => Promise<boolean>;
  saveSettings: (values: Record<string, string>) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const AUTO_LOCK_MS = 5 * 60 * 1000;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AppStatus>('loading');
  const [adminName, setAdminName] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const pinHash = useRef<string | null>(null);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDatabase();
        const profile = await getAdminProfile();
        const storedSettings = await getSettings();
        if (cancelled) {
          return;
        }
        setSettings(storedSettings);
        if (profile) {
          pinHash.current = profile.pinHash;
          setAdminName(profile.name);
          // Open straight to the app on launch. The PIN is still used when the
          // admin locks the app or after the background auto-lock timeout.
          setStatus('unlocked');
        } else {
          setStatus('setup');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus('setup');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lock = useCallback(() => {
    if (pinHash.current) {
      setStatus('locked');
    }
  }, []);

  useEffect(() => {
    if (status !== 'unlocked') {
      return;
    }
    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'background' || next === 'inactive') {
          backgroundAt.current = Date.now();
        } else if (next === 'active' && backgroundAt.current) {
          if (Date.now() - backgroundAt.current > AUTO_LOCK_MS) {
            lock();
          }
          backgroundAt.current = null;
        }
      },
    );
    return () => subscription.remove();
  }, [status, lock]);

  const setup = useCallback(async (name: string, pin: string) => {
    const hash = hashPin(pin);
    await createAdminProfile(name.trim() || 'Admin', hash);
    pinHash.current = hash;
    setAdminName(name.trim() || 'Admin');
    setStatus('unlocked');
  }, []);

  const unlock = useCallback(async (pin: string) => {
    if (!pinHash.current) {
      return false;
    }
    const ok = verifyPin(pin, pinHash.current);
    if (ok) {
      setStatus('unlocked');
    }
    return ok;
  }, []);

  const changePin = useCallback(
    async (currentPin: string, nextPin: string) => {
      if (!pinHash.current || !verifyPin(currentPin, pinHash.current)) {
        return false;
      }
      const hash = hashPin(nextPin);
      await setAdminPin(hash);
      pinHash.current = hash;
      return true;
    },
    [],
  );

  const saveSettings = useCallback(async (values: Record<string, string>) => {
    for (const [key, value] of Object.entries(values)) {
      await setSetting(key, value);
    }
    setSettings((current) => ({ ...current, ...values }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      status,
      adminName,
      settings,
      error,
      setup,
      unlock,
      lock,
      changePin,
      saveSettings,
    }),
    [
      status,
      adminName,
      settings,
      error,
      setup,
      unlock,
      lock,
      changePin,
      saveSettings,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
}
