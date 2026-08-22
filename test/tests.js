/**
 * tests.js — csv.js / schedule.js(純粋関数)のユニットテスト。
 * ブラウザで test/index.html を開くか、test/run.ps1 で実行できる(Node なし・ビルド不要)。
 */
(function (AMS) {
  'use strict';

  var CSV = AMS.csv;
  var S = AMS.schedule;

  var cases = [];
  function test(name, fn) { cases.push({ name: name, fn: fn }); }

  function fail(msg) { throw new Error(msg); }
  function eq(actual, expected, msg) {
    if (actual !== expected) fail((msg || '') + ' — 期待値 ' + JSON.stringify(expected) + ' / 実際 ' + JSON.stringify(actual));
  }
  function ok(cond, msg) { if (!cond) fail(msg || '条件を満たしていません'); }

  // ------------------------------------------------------- csv.js

  test('csv: 単純なカンマ区切り', function () {
    var rows = CSV.parseCSV('a,b,c\n1,2,3\n');
    eq(rows.length, 2);
    eq(rows[0].join('|'), 'a|b|c');
    eq(rows[1].join('|'), '1|2|3');
  });

  test('csv: 引用符内のカンマはフィールド区切りにならない', function () {
    var rows = CSV.parseCSV('"a,b",c\n');
    eq(rows[0][0], 'a,b');
    eq(rows[0][1], 'c');
  });

  test('csv: 引用符内の改行はセル内の改行として保持される', function () {
    var rows = CSV.parseCSV('"line1\nline2",b\n');
    eq(rows.length, 1);
    eq(rows[0][0], 'line1\nline2');
  });

  test('csv: 二重引用符のエスケープ("")', function () {
    var rows = CSV.parseCSV('"say ""hi""",b\n');
    eq(rows[0][0], 'say "hi"');
  });

  test('csv: CRLF 改行 / 末尾の空行は無視', function () {
    var rows = CSV.parseCSV('a,b\r\nc,d\r\n');
    eq(rows.length, 2);
    eq(rows[1].join('|'), 'c|d');
  });

  // ------------------------------------------------------- schedule.js

  function sampleCsv() {
    return [
      '"新潟店　レッスンスケジュール　≪会員様専用≫","","2026/8/12更新"',
      '"曜日","講師","8月","9月","教科"',
      '"月","シブヤ先生","３，１７，３１","７，１４，２８","エレキギター科\nウクレレ科"',
      '"","山口 孝弘先生","３，１７，２４","７，１４，２８","エレキギター科"',
      '"火","小林 正朗先生","４，１８，２５","８，１５，２９","ドラム科"'
    ].join('\r\n') + '\r\n';
  }

  test('schedule: 更新日を抽出できる', function () {
    var data = S.parseSchedule(sampleCsv());
    eq(data.updatedAt, '2026/8/12');
  });

  test('schedule: 月の見出し(ヘッダー)を抽出できる', function () {
    var data = S.parseSchedule(sampleCsv());
    eq(data.monthLabels.join('|'), '8月|9月');
  });

  test('schedule: 曜日の空欄セルは直前の曜日を引き継ぐ(結合セル相当)', function () {
    var data = S.parseSchedule(sampleCsv());
    eq(data.rows[0].weekday, '月');
    eq(data.rows[1].weekday, '月');
    eq(data.rows[2].weekday, '火');
  });

  test('schedule: 全角数字・全角読点は半角に正規化される', function () {
    var data = S.parseSchedule(sampleCsv());
    eq(data.rows[0].months[0].dates, '3, 17, 31');
    eq(data.rows[0].months[1].dates, '7, 14, 28');
  });

  test('schedule: 教科セルの複数行はそれぞれ別の項目になる', function () {
    var data = S.parseSchedule(sampleCsv());
    eq(data.rows[0].subjects.join('|'), 'エレキギター科|ウクレレ科');
  });

  test('schedule: 「※」で始まる注記は日付と分けて保持される', function () {
    var csv =
      '"曜日","講師","8月","9月","教科"\r\n' +
      '"月","五十嵐 友輔先生","２，２３，９/６\n※9/6は8月の3回目です。","１３，２０","トロンボーン科"\r\n';
    var data = S.parseSchedule(csv);
    eq(data.rows[0].months[0].dates, '2, 23, 9/6');
    eq(data.rows[0].months[0].notes.join('|'), '※9/6は8月の3回目です。');
    eq(data.rows[0].months[1].notes.length, 0);
  });

  test('schedule: 講師セルが複数行でも1つの名前として結合される', function () {
    var csv =
      '"曜日","講師","8月","9月","教科"\r\n' +
      '"金","ギター科\n長谷川 裕二先生","７，２１，２８","１１，１８，２５","エレキギター科"\r\n';
    var data = S.parseSchedule(csv);
    eq(data.rows[0].teacher, 'ギター科 長谷川 裕二先生');
  });

  test('schedule: (A)(上)(D) のような符号付き日付もそのまま保持する(時間としては解釈しない)', function () {
    var csv =
      '"曜日","講師","8月","9月","教科"\r\n' +
      '"土","間瀬 啓介先生","１（A），２２（上），２９（上）","５（上），１２（上），１９（A）","ドラム科"\r\n';
    var data = S.parseSchedule(csv);
    eq(data.rows[0].months[0].dates, '1(A), 22(上), 29(上)');
  });

  test('schedule: weekdaysPresent は曜日順(月火水木金土日)で重複なく返す', function () {
    var data = S.parseSchedule(sampleCsv());
    eq(S.weekdaysPresent(data.rows).join(''), '月火');
  });

  test('schedule: rowsForWeekday は指定曜日の行だけを返す', function () {
    var data = S.parseSchedule(sampleCsv());
    var rows = S.rowsForWeekday(data.rows, '月');
    eq(rows.length, 2);
    eq(rows[0].teacher, 'シブヤ先生');
    eq(rows[1].teacher, '山口 孝弘先生');
  });

  test('schedule: scheduleUrl はシートIDから gviz CSV エンドポイントを組み立てる', function () {
    var url = S.scheduleUrl('ABC123');
    var expected = 'https:' + '/' + '/docs.google.com/spreadsheets/d/ABC123/gviz/tq?tqx=out:csv';
    eq(url, expected);
  });

  test('schedule: ヘッダー行が見つからない場合は空データを返す(落ちない)', function () {
    var data = S.parseSchedule('"何かのお知らせ","",""\r\n');
    eq(data.rows.length, 0);
    eq(data.monthLabels.length, 0);
  });

  // ------------------------------------------------------------ 実行

  function run() {
    var results = [];
    var passed = 0;
    for (var i = 0; i < cases.length; i++) {
      try {
        cases[i].fn();
        results.push({ name: cases[i].name, ok: true });
        passed++;
      } catch (e) {
        results.push({ name: cases[i].name, ok: false, message: e && e.message ? e.message : String(e) });
      }
    }
    return { results: results, passed: passed, total: cases.length };
  }

  AMS.tests = { run: run, cases: cases };
})(this.AMS = this.AMS || {});
