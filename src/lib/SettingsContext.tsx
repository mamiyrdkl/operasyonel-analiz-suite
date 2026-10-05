'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface DelayCode {
  code: string;
  desc: string;
}

const DEFAULT_CHIEFS = ["SERDAR ERDOĞAN", "MESUT USLU", "MEHMET YARTAŞI", "İBRAHİM HAKKI AVŞAR"];
const DEFAULT_DELAY_CODES: DelayCode[] = [
    { code: "64B", desc: "Kokpit personelinin görev süresi aşımı" }, 
    { code: "64D", desc: "Ekip planlaması veya ekip kontrol hatası" },
    { code: "64E", desc: "Ekip Kaynaklı - Diğer (64E)" },
    { code: "67B", desc: "Kabin ekibi görev süresi aşımı" },
    { code: "67E", desc: "Ekip planlaması veya ekip kontrol hatası" }, 
    { code: "67F", desc: "Yedek Kabin Ekibi beklenmesi" },
    { code: "94",  desc: "Kabin ekibinin baglantili seferi" }, 
    { code: "94A", desc: "Kabin ekibinin planlı uçuşa geç kalması" },
    { code: "94B", desc: "Kabin ekibinin planlı uçuşa geç kalması" }, 
    { code: "95",  desc: "Tüm ekibin baglantılı seferi" },
    { code: "95A", desc: "Tüm ekibin planlı uçuşa geç kalması" }, 
    { code: "95B", desc: "Tüm ekibin planlı uçuşa geç kalması" },
    { code: "95C", desc: "Kokpit ekibinin planlı uçuşa geç kalması" }, 
    { code: "95D", desc: "Kokpit ekibinin planlı uçuşa geç kalması" }
];

interface SettingsContextType {
  chiefs: string[];
  saveChiefs: (newChiefs: string[]) => void;
  delayCodes: DelayCode[];
  saveDelayCodes: (newCodes: DelayCode[]) => void;
  geminiKey: string;
  saveGeminiKey: (key: string) => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [chiefs, setChiefs] = useState<string[]>([]);
  const [delayCodes, setDelayCodes] = useState<DelayCode[]>([]);
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedChiefs = localStorage.getItem('op_analysis_chiefs');
    const storedCodes = localStorage.getItem('op_analysis_delay_codes');
    const storedKey = localStorage.getItem('op_analysis_gemini_key');

    if (storedChiefs) {
      try { setChiefs(JSON.parse(storedChiefs)); } catch { setChiefs(DEFAULT_CHIEFS); }
    } else {
      setChiefs(DEFAULT_CHIEFS);
    }

    if (storedCodes) {
      try { setDelayCodes(JSON.parse(storedCodes)); } catch { setDelayCodes(DEFAULT_DELAY_CODES); }
    } else {
      setDelayCodes(DEFAULT_DELAY_CODES);
    }

    if (storedKey) setGeminiKey(storedKey);

    setIsLoaded(true);
  }, []);

  const saveChiefs = (newChiefs: string[]) => {
    setChiefs(newChiefs);
    localStorage.setItem('op_analysis_chiefs', JSON.stringify(newChiefs));
  };

  const saveDelayCodes = (newCodes: DelayCode[]) => {
    setDelayCodes(newCodes);
    localStorage.setItem('op_analysis_delay_codes', JSON.stringify(newCodes));
  };

  const saveGeminiKey = (key: string) => {
    setGeminiKey(key);
    localStorage.setItem('op_analysis_gemini_key', key);
  };

  return (
    <SettingsContext.Provider value={{ chiefs, saveChiefs, delayCodes, saveDelayCodes, geminiKey, saveGeminiKey, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

/** Drop-in replacement for the old useSettings() hook — now reads from the shared context */
export function useSettings(): SettingsContextType {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
