/**
 * schedule.js — 店舗スケジュール表(Google スプレッドシート CSV)の解析。DOM に触れない純粋関数。
 *
 * 想定するシートの列構成(全店舗共通):
 *   曜日 | 講師 | <月1> | <月2> | 教科
 * 曜日セルは同じ曜日の間は空欄(結合セル相当)なので前方補完する。
 * 日付セルには「※◯◯は△△の×回目です。」のような注記が改行で入ることがあるため、
 * 日付行と注記行を分けて保持する。レッスン時間はシートに存在しないため扱わない。
 */
(function (AMS) {
  'use strict';

  var WEEKDAY_ORDER = AMS.constants.WEEKDAY_ORDER;

  function scheduleUrl(sheetId) {
    // 文字列中に "//" を連続させない(test/run.ps1 の簡易コメント除去が誤爆するため)
    return 'https:' + '/' + '/docs.google.com/spreadsheets/d/' + sheetId + '/gviz/tq?tqx=out:csv';
  }

  function trim(s) {
    return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '');
  }

  /** 全角数字・全角読点・全角スペースを半角に揃える(表示を読みやすくするだけで、値の意味は変えない) */
  function normalizeText(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      var code = s.charCodeAt(i);
      if (code >= 0xff10 && code <= 0xff19) {
        out += String.fromCharCode(code - 0xff10 + 48);
      } else if (c === '，' || c === '、') {
        out += ', ';
      } else if (c === '　') {
        out += ' ';
      } else if (c === '（') {
        out += '(';
      } else if (c === '）') {
        out += ')';
      } else {
        out += c;
      }
    }
    return out.replace(/\s+/g, ' ');
  }

  function splitCellLines(cell) {
    var raw = String(cell == null ? '' : cell);
    var parts = raw.split('\n');
    var lines = [];
    for (var i = 0; i < parts.length; i++) {
      var t = trim(parts[i]);
      if (t.length > 0) lines.push(t);
    }
    return lines;
  }

  function extractUpdatedAt(rows) {
    var scanRows = Math.min(rows.length, 6);
    for (var r = 0; r < scanRows; r++) {
      for (var c = 0; c < rows[r].length; c++) {
        var cell = rows[r][c];
        if (cell && cell.indexOf('更新') >= 0) {
          var m = /(\d{4}\/\d{1,2}\/\d{1,2})\s*更新/.exec(cell);
          if (m) return m[1];
        }
      }
    }
    return '';
  }

  function findHeaderRowIndex(rows) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].length > 0 && trim(rows[i][0]) === '曜日') return i;
    }
    return -1;
  }

  function parseMonthCell(cell) {
    var lines = splitCellLines(cell);
    var dateItems = [];
    var notes = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.charAt(0) === '※') {
        notes.push(line);
        continue;
      }
      var parts = normalizeText(line).split(',');
      for (var j = 0; j < parts.length; j++) {
        var t = trim(parts[j]);
        if (t.length > 0) dateItems.push(t);
      }
    }
    return { dateItems: dateItems, notes: notes };
  }

  /**
   * 日付1件を「10日」「17日(A)」「9月6日」のように読みやすく整形する。
   * 元の値の意味は変えない(符号(A)(上)等はそのまま残す)。
   */
  function formatDateItem(token) {
    var t = trim(token);
    var withMonth = /^(\d+)\/(\d+)(.*)$/.exec(t);
    if (withMonth) {
      return withMonth[1] + '月' + withMonth[2] + '日' + withMonth[3];
    }
    var dayOnly = /^(\d+)(.*)$/.exec(t);
    if (dayOnly) {
      return dayOnly[1] + '日' + dayOnly[2];
    }
    return t;
  }

  function formatDateItems(items) {
    var out = [];
    for (var i = 0; i < items.length; i++) out.push(formatDateItem(items[i]));
    return out;
  }

  /**
   * @param {string} csvText
   * @returns {{updatedAt: string, monthLabels: string[], rows: Array}}
   */
  function parseSchedule(csvText) {
    var rows = AMS.csv.parseCSV(csvText);
    var updatedAt = extractUpdatedAt(rows);
    var headerIndex = findHeaderRowIndex(rows);
    if (headerIndex < 0) {
      return { updatedAt: updatedAt, monthLabels: [], rows: [] };
    }

    var header = rows[headerIndex];
    var monthLabels = [trim(header[2]), trim(header[3])];

    var out = [];
    var currentWeekday = '';
    for (var i = headerIndex + 1; i < rows.length; i++) {
      var r = rows[i];
      var weekdayCell = trim(r[0]);
      if (weekdayCell.length > 0) currentWeekday = weekdayCell;

      var teacher = splitCellLines(r[1]).join(' ');
      if (teacher.length === 0) continue;

      out.push({
        weekday: currentWeekday,
        teacher: teacher,
        subjects: splitCellLines(r[4]),
        months: [parseMonthCell(r[2]), parseMonthCell(r[3])]
      });
    }

    return { updatedAt: updatedAt, monthLabels: monthLabels, rows: out };
  }

  function weekdaysPresent(scheduleRows) {
    var seen = {};
    for (var i = 0; i < scheduleRows.length; i++) {
      if (scheduleRows[i].weekday) seen[scheduleRows[i].weekday] = true;
    }
    var result = [];
    for (var j = 0; j < WEEKDAY_ORDER.length; j++) {
      if (seen[WEEKDAY_ORDER[j]]) result.push(WEEKDAY_ORDER[j]);
    }
    return result;
  }

  function rowsForWeekday(scheduleRows, weekday) {
    var result = [];
    for (var i = 0; i < scheduleRows.length; i++) {
      if (scheduleRows[i].weekday === weekday) result.push(scheduleRows[i]);
    }
    return result;
  }

  AMS.schedule = {
    scheduleUrl: scheduleUrl,
    parseSchedule: parseSchedule,
    weekdaysPresent: weekdaysPresent,
    rowsForWeekday: rowsForWeekday,
    formatDateItem: formatDateItem,
    formatDateItems: formatDateItems
  };
})(this.AMS = this.AMS || {});
