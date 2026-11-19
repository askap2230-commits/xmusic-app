// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

export type Locale = 'id' | 'en';

export type TranslationDict = {
  // Navigation & Tabs
  'nav.home': string;
  'nav.search': string;
  'nav.library': string;
  'nav.eq': string;
  'nav.profile': string;
  'nav.title.home': string;
  'nav.title.search': string;
  'nav.title.library': string;
  'nav.title.eq': string;
  'nav.title.profile': string;
  'nav.skip': string;
  'nav.themeToLight': string;
  'nav.themeToDark': string;
  'nav.openQueue': string;
  'nav.sleepTimerPrefix': string;
  'nav.sleepEndOfTrack': string;

  // Greetings
  'greeting.morning': string;
  'greeting.afternoon': string;
  'greeting.evening': string;
  'greeting.night': string;

  // Home View
  'home.headline': string;
  'home.refresh': string;
  'home.loading': string;
  'home.upload': string;
  'home.demo': string;
  'home.hubLink': string;
  'home.algorithm': string;
  'home.offlineCollection': string;
  'home.all': string;
  'home.offlineTitle': string;
  'home.offlineDesc': string;
  'home.retry': string;
  'home.offlineBtn': string;
  'home.loadingYt': string;
  'home.ytBusy': string;
  'home.loadMore': string;
  'home.loadingMore': string;
  'home.audiusTitle': string;
  'home.loadingAudius': string;
  'home.eraTitle': string;
  'home.genreTitle': string;
  'home.spotifyTitle': string;
  'home.loadingChart': string;
  'home.chartFailed': string;
  'home.reload': string;
  'home.spotifyOfflineTitle': string;
  'home.spotifyOfflineDesc': string;
  'home.catalogTitle': string;
  'home.loadingCatalog': string;

  // Search View
  'search.placeholder': string;
  'search.suggesting': string;
  'search.offlineNotice': string;
  'search.recent': string;
  'search.clear': string;
  'search.trending': string;
  'search.eraExplore': string;
  'search.genreExplore': string;
  'search.fullOnly': string;
  'search.sourceAll': string;
  'search.sourceLocal': string;
  'search.allEras': string;
  'search.results': string;
  'search.searching': string;
  'search.noResults': string;
  'search.resetFilters': string;

  // Library View
  'library.tabOffline': string;
  'library.tabLiked': string;
  'library.tabHistory': string;
  'library.uploadAudio': string;
  'library.createPlaylist': string;
  'library.yourPlaylists': string;
  'library.sectionOffline': string;
  'library.sectionLiked': string;
  'library.sectionHistory': string;
  'library.sectionPlaylist': string;
  'library.viewGrid': string;
  'library.viewList': string;
  'library.playAll': string;
  'library.shuffle': string;
  'library.playing': string;
  'library.emptyTitle': string;
  'library.emptyDesc': string;
  'library.createDemo': string;
  'library.moreCount': string;

  // Player & Track Modal
  'player.nowPlaying': string;
  'player.syncedLyrics': string;
  'player.resolvingAudio': string;
  'player.audioFailed': string;
  'player.retryAudio': string;
  'player.videoFallback': string;
  'player.lyricsBtn': string;
  'player.playlistBtn': string;
  'player.stopBtn': string;
  'player.findFullBtn': string;
  'player.downloadMp3Btn': string;
  'player.spotifyNativeDesc': string;
  'player.playFullInApp': string;
  'player.searchLyrics': string;
  'player.editTrack': string;
  'player.fetchingLyrics': string;
  'player.noLyrics': string;
  'player.autoFindLyrics': string;
  'player.backToCover': string;
  'player.openFull': string;

  // Equalizer View
  'eq.sectionTitle': string;
  'eq.enableTitle': string;
  'eq.enableSub': string;
  'eq.limiterTitle': string;
  'eq.limiterSub': string;
  'eq.resetBtn': string;
  'eq.stereoSpeedTitle': string;
  'eq.balanceTitle': string;
  'eq.balanceCenter': string;
  'eq.pitchTitle': string;
  'eq.pitchSub': string;
  'eq.speedTitle': string;
  'eq.sleepTitle': string;
  'eq.sleepActive': string;

  // Profile View
  'profile.editApi': string;
  'profile.languageSection': string;
  'profile.languageTitle': string;
  'profile.languageSub': string;
  'profile.appearanceSection': string;
  'profile.darkMode': string;
  'profile.themeAuto': string;
  'profile.themeLight': string;
  'profile.themeDark': string;
  'profile.themeAutoStatus': string;
  'profile.themeDarkActive': string;
  'profile.themeLightActive': string;
  'profile.algoSection': string;
  'profile.personalizeTitle': string;
  'profile.personalizeOn': string;
  'profile.personalizeOff': string;
  'profile.algoMode': string;
  'profile.modeViral': string;
  'profile.modeBalanced': string;
  'profile.modeDiscovery': string;
  'profile.modeNostalgia': string;
  'profile.regionLabel': string;
  'profile.eraPriority': string;
  'profile.genreInterest': string;
  'profile.privacyTitle': string;
  'profile.privacySub': string;
  'profile.resetBtn': string;
  'profile.statusSection': string;
  'profile.networkStatus': string;
  'profile.networkSub': string;
  'profile.online': string;
  'profile.offline': string;
  'profile.ytFossTitle': string;
  'profile.ytFossSub': string;
  'profile.active': string;
  'profile.collectionFav': string;
  'profile.appEngine': string;
  'profile.platformArch': string;
  'profile.licenseTitle': string;

  // Queue Drawer
  'queue.title': string;
  'queue.tabQueue': string;
  'queue.tabLyrics': string;
  'queue.clearAll': string;
  'queue.empty': string;
  'queue.noTrack': string;
  'queue.noLyrics': string;

  // Common
  'common.close': string;
  'common.save': string;
  'common.full': string;
  'common.preview30s': string;
};

export type TranslationKey = keyof TranslationDict;
