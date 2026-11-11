import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./i18n/en";
import { id, type Dictionary } from "./i18n/id";

export type Lang = "id" | "en";

const STORAGE_KEY = "simpul-lang";
const DICTS: Record<Lang, Dictionary> = { id, en };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "id" || saved === "en") return saved;
  } catch {
    /* abaikan — gunakan default */
  }
  return "id";
}

/** Ambil nilai pada path "a.b.c" dari kamus; undefined bila tidak ada. */
function lookup(dict: Dictionary, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Penerjemah dengan fallback: en → id → kunci mentah. */
  t: (key: string) => string;
  /** Format tanggal/waktu sadar-lokal dari ISO string. */
  formatDate: (iso: string | null | undefined, withTime?: boolean) => string;
}

const I18nContext = createContext<I18nState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* penyimpanan privat — preferensi sesi ini saja */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback(
    (key: string): string =>
      lookup(DICTS[lang], key) ?? lookup(DICTS.id, key) ?? key,
    [lang],
  );

  const formatDate = useCallback(
    (iso: string | null | undefined, withTime = false): string => {
      if (!iso) return "—";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      const locale = lang === "id" ? "id-ID" : "en-GB";
      return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" as const } : {}),
      }).format(d);
    },
    [lang],
  );

  const value = useMemo<I18nState>(
    () => ({ lang, setLang, t, formatDate }),
    [lang, setLang, t, formatDate],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n harus dipakai di dalam LanguageProvider");
  return ctx;
}
