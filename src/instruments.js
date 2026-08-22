/**
 * instruments.js — 教科名(◯◯科)から楽器アイコン(絵文字)を選ぶ。DOM に触れない純粋関数。
 * ぴったりの絵文字が無い楽器は、近い仲間の楽器で代用する(例: トロンボーン科→トランペットの絵文字)。
 *
 * 絵文字は文字化け・文字コード事故を避けるため、コードポイントから組み立てる
 * (String.fromCharCode はサロゲートペア対応、cscript のES3エンジンでも動く)。
 */
(function (AMS) {
  'use strict';

  function emoji(codePoint) {
    var c = codePoint - 0x10000;
    var hi = 0xd800 + (c >> 10);
    var lo = 0xdc00 + (c & 0x3ff);
    return String.fromCharCode(hi, lo);
  }

  var NOTE = emoji(0x1f3b5);
  var PIANO = emoji(0x1f3b9); // Unicode上の正式名は MUSICAL KEYBOARD
  var DRUM = emoji(0x1f941);
  var MIC = emoji(0x1f3a4);
  var SAX = emoji(0x1f3b7);
  var TRUMPET = emoji(0x1f3ba);
  var VIOLIN = emoji(0x1f3bb);
  var GUITAR = emoji(0x1f3b8);
  var NOTES = emoji(0x1f3b6); // NOTE(1音符)と区別するための複数音符
  var FLUTE = emoji(0x1fa88);
  var ACCORDION = emoji(0x1fa97);

  var DEFAULT_ICON = NOTE;

  // 先に判定したいキーワードほど上に書く(「エレキベース」等は「ギター」より先にベースで拾う)
  var ICON_RULES = [
    ['ピアノ', PIANO],
    ['キーボード', PIANO],
    ['ドラム', DRUM],
    ['パーカッション', DRUM],
    ['パンデイロ', DRUM],
    ['ボーカル', MIC],
    ['ボイス', MIC],
    ['サックス', SAX],
    ['トランペット', TRUMPET],
    ['トロンボーン', TRUMPET], // 専用絵文字が無いためトランペットで代用
    ['バイオリン', VIOLIN],
    ['ヴァイオリン', VIOLIN],
    ['チェロ', VIOLIN], // 専用絵文字が無いためバイオリンで代用
    ['フルート', FLUTE],
    ['オカリナ', FLUTE], // 専用絵文字が無いためフルートで代用
    ['クラリネット', NOTES], // 専用絵文字が無いため音符で代用
    ['アコーディオン', ACCORDION],
    ['ベース', GUITAR], // 専用絵文字が無いためギターで代用
    ['マンドリン', GUITAR],
    ['ウクレレ', GUITAR],
    ['ギター', GUITAR]
  ];

  function iconForSubject(subject) {
    var s = String(subject == null ? '' : subject);
    for (var i = 0; i < ICON_RULES.length; i++) {
      if (s.indexOf(ICON_RULES[i][0]) >= 0) return ICON_RULES[i][1];
    }
    return DEFAULT_ICON;
  }

  /** 複数教科のうち、代表(先頭)の教科からアイコンを選ぶ */
  function iconForSubjects(subjects) {
    if (!subjects || subjects.length === 0) return DEFAULT_ICON;
    return iconForSubject(subjects[0]);
  }

  AMS.instruments = {
    DEFAULT_ICON: DEFAULT_ICON,
    iconForSubject: iconForSubject,
    iconForSubjects: iconForSubjects
  };
})(this.AMS = this.AMS || {});
