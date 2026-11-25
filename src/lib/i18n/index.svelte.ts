// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

import { en } from './en.ts';
import { id } from './id.ts';
import type { Locale, TranslationDict, TranslationKey } from './types.ts';

const PARTIAL_LOCALES: Partial<Record<Locale, Partial<TranslationDict>>> = {
  ja: {
    'nav.home': 'ホーム',
    'nav.search': '検索',
    'nav.library': 'ライブラリ',
    'nav.eq': 'イコライザー',
    'nav.profile': 'プロフィール',
    'nav.title.home': 'ホーム',
    'nav.title.search': '検索',
    'nav.title.library': 'ライブラリ',
    'nav.title.eq': 'イコライザー',
    'nav.title.profile': 'プロフィール',
    'home.headline': 'プレミアム音楽体験',
    'home.refresh': '更新',
    'home.upload': 'アップロード',
    'home.offlineCollection': 'オフラインコレクション',
    'search.placeholder': '曲名、アーティスト、アルバムを検索...',
    'library.playAll': 'すべて再生',
    'library.shuffle': 'シャッフル',
    'player.nowPlaying': '再生中',
    'player.syncedLyrics': '同期歌詞',
    'profile.editApi': 'プロフィール・バナー編集',
    'profile.languageSection': 'グローバル言語設定',
    'profile.languageTitle': '表示言語',
    'profile.languageSub': '国際企業向けの多言語インターフェース切替'
  },
  ko: {
    'nav.home': '홈',
    'nav.search': '검색',
    'nav.library': '보관함',
    'nav.eq': '이퀄라이저',
    'nav.profile': '프로필',
    'nav.title.home': '홈',
    'nav.title.search': '검색',
    'nav.title.library': '보관함',
    'nav.title.eq': '이퀄라이저',
    'nav.title.profile': '프로필',
    'home.headline': '프리미엄 오디오 스트리밍',
    'home.refresh': '새로고침',
    'home.upload': '업로드',
    'home.offlineCollection': '오프라인 보관함',
    'search.placeholder': '노래, 아티스트, 앨범 검색...',
    'library.playAll': '전체 재생',
    'library.shuffle': '셔플',
    'player.nowPlaying': '지금 재생 중',
    'player.syncedLyrics': '실시간 가사',
    'profile.editApi': '프로필 및 배너 편집',
    'profile.languageSection': '글로벌 언어',
    'profile.languageTitle': '인터페이스 언어',
    'profile.languageSub': '글로벌 엔터프라이즈 다국어 지원'
  },
  es: {
    'nav.home': 'Inicio',
    'nav.search': 'Buscar',
    'nav.library': 'Biblioteca',
    'nav.eq': 'Ecualizador',
    'nav.profile': 'Perfil',
    'nav.title.home': 'Inicio',
    'nav.title.search': 'Buscar',
    'nav.title.library': 'Biblioteca',
    'nav.title.eq': 'Ecualizador',
    'nav.title.profile': 'Perfil',
    'home.headline': 'Transmisión de Audio Global',
    'home.refresh': 'Actualizar',
    'home.upload': 'Subir Audio',
    'home.offlineCollection': 'Colección Sin Conexión',
    'search.placeholder': 'Buscar canciones, artistas o álbumes...',
    'library.playAll': 'Reproducir Todo',
    'library.shuffle': 'Aleatorio',
    'player.nowPlaying': 'Reproduciendo',
    'player.syncedLyrics': 'Letra Sincronizada',
    'profile.editApi': 'Editar Perfil y Banner',
    'profile.languageSection': 'Idioma Internacional',
    'profile.languageTitle': 'Idioma de la Interfaz',
    'profile.languageSub': 'Soporte multilingüe corporativo internacional'
  },
  ar: {
    'nav.home': 'الرئيسية',
    'nav.search': 'بحث',
    'nav.library': 'المكتبة',
    'nav.eq': 'المعادل',
    'nav.profile': 'الملف الشخصي',
    'nav.title.home': 'الرئيسية',
    'nav.title.search': 'بحث',
    'nav.title.library': 'المكتبة',
    'nav.title.eq': 'المعادل',
    'nav.title.profile': 'الملف الشخصي',
    'home.headline': 'بث صوتي عالمي فائق الجودة',
    'home.refresh': 'تحديث',
    'home.upload': 'رفع ملف',
    'home.offlineCollection': 'المجموعة المحلية',
    'search.placeholder': 'ابحث عن أغنية أو فنان...',
    'library.playAll': 'تشغيل الكل',
    'library.shuffle': 'عشوائي',
    'player.nowPlaying': 'قيد التشغيل الآن',
    'player.syncedLyrics': 'كلمات متزامنة',
    'profile.editApi': 'تعديل الملف والبانر',
    'profile.languageSection': 'اللغة الدولية',
    'profile.languageTitle': 'لغة الواجهة',
    'profile.languageSub': 'واجهة دولية متعددة اللغات'
  }
};

const ALL_LOCALES: Locale[] = ['en', 'id', 'ja', 'ko', 'es', 'ar'];
const STORAGE_KEY = 'nys_locale';

class I18nStore {
  locale = $state<Locale>('en');

  init(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && ALL_LOCALES.includes(saved)) {
        this.locale = saved;
      } else if (typeof navigator !== 'undefined' && navigator.language) {
        const prefix = navigator.language.toLowerCase().slice(0, 2) as Locale;
        this.locale = ALL_LOCALES.includes(prefix) ? prefix : 'en';
      }
    } catch {
      this.locale = 'en';
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
      document.documentElement.dir = this.locale === 'ar' ? 'rtl' : 'ltr';
    }
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    if (this.locale === 'id') {
      let text = id[key] ?? en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replaceAll(`{${k}}`, String(v));
        }
      }
      return text;
    }
    const partial = PARTIAL_LOCALES[this.locale];
    let text = partial?.[key] ?? en[key] ?? id[key] ?? key;
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
