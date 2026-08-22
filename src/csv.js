/**
 * csv.js — RFC4180 相当の CSV パーサー(引用符内の改行・カンマ・二重引用符に対応)
 */
(function (AMS) {
  'use strict';

  /**
   * CSV テキストを行×列の文字列配列に変換する。
   * @returns {string[][]}
   */
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var len = text.length;

    function pushField() {
      row.push(field);
      field = '';
    }
    function pushRow() {
      pushField();
      rows.push(row);
      row = [];
    }

    while (i < len) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ',') {
        pushField();
        i += 1;
        continue;
      }
      if (ch === '\r') {
        i += 1;
        continue;
      }
      if (ch === '\n') {
        pushRow();
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
    }
    if (field.length > 0 || row.length > 0) {
      pushRow();
    }
    if (rows.length > 0) {
      var last = rows[rows.length - 1];
      if (last.length === 1 && last[0] === '') {
        rows.pop();
      }
    }
    return rows;
  }

  AMS.csv = { parseCSV: parseCSV };
})(this.AMS = this.AMS || {});
