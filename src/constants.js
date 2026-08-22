/**
 * constants.js — 店舗一覧・曜日順・保存キーの一元管理
 */
(function (AMS) {
  'use strict';

  // 文字列中に "//" を連続させない(test/run.ps1 の簡易コメント除去が誤爆するため)
  var SITE_BASE = 'https:' + '/' + '/sites.google.com/site/apollonmusicschool/';

  var STORES = [
    { id: 'niigata', name: '新潟店', sheetId: '1f4Bc8aJ3U4RT6NUE1_Aule1USXHoTGkMqTKjqK_FuHg', sitePath: 'home' },
    { id: 'higashikuyakusho', name: '新潟東区役所店', sheetId: '1zkHjToAnYfhpWO5MUYoFW68SCyiS7xJGrIAz65Bhd2E', sitePath: 'higashikuyakusho' },
    { id: 'ekinnan', name: '新潟駅南店', sheetId: '18so1PfWLcOKqwG4qu_OevdClIvJdHKNfNFFeBH7t04I', sitePath: 'xin-xi-yi-nan-dian-jiao-shisukejuru' },
    { id: 'aeon-nishi', name: 'イオン新潟西店', sheetId: '1-emCvM4jvM3PQBjbBU5IwOAC0kCZJoffyarlFq6fywQ', sitePath: 'ionmoru-xin-xi-xi-dian' },
    { id: 'aeon-shibata', name: 'イオンモール新発田店', sheetId: '1MQ-p4uvV14Pl67glx-KGDZ6O77zTU1maaL_qnklIC3Y', sitePath: 'ionmoru-xin-fa-tian-dian' },
    { id: 'nagaoka', name: '長岡店', sheetId: '1dz51wROxPjBagAxHTyQ2lOgPspnBj_GgcLYzzUOTK9A', sitePath: 'zhang-gang-dian' },
    { id: 'sanjo', name: '三条店', sheetId: '1jpqGRg1MB4S3khaMPd5vTQRghNXwgv0dXtdHdNkzyfA', sitePath: 'san-tiao-dian' }
  ];

  for (var s = 0; s < STORES.length; s++) {
    STORES[s].siteUrl = SITE_BASE + STORES[s].sitePath;
  }

  var WEEKDAY_ORDER = ['月', '火', '水', '木', '金', '土', '日'];

  var STORAGE_KEYS = {
    lastSelection: 'ams-schedule:last-selection',
    cachePrefix: 'ams-schedule:cache:'
  };

  function storeById(id) {
    for (var i = 0; i < STORES.length; i++) {
      if (STORES[i].id === id) return STORES[i];
    }
    return null;
  }

  AMS.constants = {
    STORES: STORES,
    WEEKDAY_ORDER: WEEKDAY_ORDER,
    STORAGE_KEYS: STORAGE_KEYS,
    storeById: storeById
  };
})(this.AMS = this.AMS || {});
