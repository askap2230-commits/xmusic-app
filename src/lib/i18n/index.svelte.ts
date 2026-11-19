// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

import { en } from './en.ts';
import { id } from './id.ts';
import type { Locale, TranslationDict, TranslationKey } from './types.ts';

const DICTIONARIES: Record<Locale, TranslationDict> = { id, en };
const STORAGE_KEY = 'nys_locale';

class I18nStore {
  locale = $state<Locale>('id');

  init(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'id' || saved === 'en') {
        this.locale = saved;
      } else if (typeof navigator !== 'undefined' && navigator.language) {
        this.locale = navigator.language.toLowerCase().startsWith('id') ? 'id' : 'en';
      }
    } catch {
      this.locale = 'id';
    }
    this.syncDocumentLang();
  }

  setLocale(next: Locale): void {
    if (this.locale === next) return;
    this.locale = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
    this.syncDocumentLang();
  }

  private syncDocumentLang(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.locale;
    }
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const dict = DICTIONARIES[this.locale] || DICTIONARIES.id;
    let text = dict[key] ?? DICTIONARIES.id[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  }
}

export const i18n = new I18nStore();
export type { Locale, TranslationKey };
