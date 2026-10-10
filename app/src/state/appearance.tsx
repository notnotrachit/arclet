import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BrandLoading } from '@/ui/Brand';
import { readJson, writeJson } from '@/lib/storage';
import { ThemeContext, themes } from '@/ui/theme';

export type AppearancePreference = 'light' | 'dark' | 'system';
const storageKey = 'settings:appearance';
const AppearanceContext = createContext<{
  preference: AppearancePreference;
  setPreference: (value: AppearancePreference) => Promise<void>;
}>({ preference: 'system', setPreference: async () => {} });

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setSelected] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    readJson<unknown>(storageKey, 'system').then((saved) => {
      if (!active) return;
      if (saved === 'light' || saved === 'dark' || saved === 'system') setSelected(saved);
      setReady(true);
    });
    return () => { active = false; };
  }, []);
  const setPreference = useCallback((value: AppearancePreference) => {
    // Serialize writes so fast repeated selections always persist in order.
    const next = writes.current.catch(() => {}).then(() => writeJson(storageKey, value));
    writes.current = next;
    return next.then(() => setSelected(value));
  }, []);
  const mode = preference === 'system' ? system === 'dark' ? 'dark' : 'light' : preference;
  const theme = themes[mode];
  return <AppearanceContext.Provider value={{ preference, setPreference }}>
    <ThemeContext.Provider value={theme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} animated />
      {ready ? children : <BrandLoading />}
    </ThemeContext.Provider>
  </AppearanceContext.Provider>;
}
export const useAppearance = () => useContext(AppearanceContext);
