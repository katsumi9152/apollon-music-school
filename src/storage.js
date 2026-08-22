/**
 * storage.js — localStorage への保存/読込。前回選んだ教室・曜日・先生を次回の初期値にする。
 * ブックマークからの再訪問が主な使い方なので、ここで覚えておく。
 */
(function (AMS) {
  'use strict';

  var KEYS = AMS.constants.STORAGE_KEYS;

  function hasLocalStorage() {
    try {
      return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch (e) {
      return false;
    }
  }

  function loadSelection() {
    if (!hasLocalStorage()) return null;
    try {
      var raw = localStorage.getItem(KEYS.lastSelection);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSelection(selection) {
    if (!hasLocalStorage()) return;
    try {
      localStorage.setItem(KEYS.lastSelection, JSON.stringify(selection));
    } catch (e) {}
  }

  function loadCache(storeId) {
    if (!hasLocalStorage()) return null;
    try {
      var raw = localStorage.getItem(KEYS.cachePrefix + storeId);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveCache(storeId, csvText) {
    if (!hasLocalStorage()) return;
    try {
      localStorage.setItem(
        KEYS.cachePrefix + storeId,
        JSON.stringify({ csvText: csvText, fetchedAt: new Date().toISOString() })
      );
    } catch (e) {}
  }

  function loadTheme() {
    if (!hasLocalStorage()) return null;
    try {
      return localStorage.getItem(KEYS.theme);
    } catch (e) {
      return null;
    }
  }

  function saveTheme(theme) {
    if (!hasLocalStorage()) return;
    try {
      localStorage.setItem(KEYS.theme, theme);
    } catch (e) {}
  }

  AMS.storage = {
    loadSelection: loadSelection,
    saveSelection: saveSelection,
    loadCache: loadCache,
    saveCache: saveCache,
    loadTheme: loadTheme,
    saveTheme: saveTheme
  };
})(this.AMS = this.AMS || {});
