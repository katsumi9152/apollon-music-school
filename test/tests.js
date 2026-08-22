/**
 * tests.js — csv.js / schedule.js(純粋関数)のユニットテスト。
 * ブラウザで test/index.html を開くか、test/run.ps1 で実行できる(Node なし・ビルド不要)。
 */
(function (AMS) {
  'use strict';

  var CSV = AMS.csv;
  var S = AMS.schedule;
  var I = AMS.instruments;
  var K = AMS.constants;

  var cases = [];
  function test(name, fn) { cases.push({ name: name, fn: fn }); }

  function fail(msg) { throw new Error(msg); }
  function eq(actual, expected, msg) {
    if (actual !== expected) fail((msg || '') + ' — 期待値 ' + JSON.stringify(expected) + ' / 実際 ' + JSON.stringify(actual));
  }
  function ok(cond, msg) { if (!cond) fail(msg || '条件を満たしていません'); }

  // ------------------------------------------------------- constants.js

  test('constants: 全店舗に有効な siteUrl(https:で始まる)が設定されている', function () {
    for (var i = 0; i < K.STORES.length; i++) {
      var store = K.STORES[i];
      ok(store.siteUrl && store.siteUrl.indexOf('https:' + '/' + '/sites.google.com/') === 0,
        store.id + ' の siteUrl');
    }
  });

  test('constants: storeById は id からその店舗を返す', function () {
    eq(K.storeById('sanjo').name, '三条店');
    eq(K.storeById('no-such-id'), null);
  });

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

  test('schedule: 全角数字は半角に正規化され、日付ごとに配列で保持される', function () {
    var data = S.parseSchedule(sampleCsv());
    eq(data.rows[0].months[0].dateItems.join('|'), '3|17|31');
    eq(data.rows[0].months[1].dateItems.join('|'), '7|14|28');
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
    eq(data.rows[0].months[0].dateItems.join('|'), '2|23|9/6');
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
    eq(data.rows[0].months[0].dateItems.join('|'), '1(A)|22(上)|29(上)');
  });

  test('schedule: formatDateItem は日付を「◯日」の形に整形する', function () {
    eq(S.formatDateItem('3'), '3日');
    eq(S.formatDateItem('17(A)'), '17日(A)');
    eq(S.formatDateItem('9/6'), '9月6日');
    eq(S.formatDateItem('8/31(上)'), '8月31日(上)');
  });

  test('schedule: formatDateItems は複数件をまとめて整形する', function () {
    eq(S.formatDateItems(['3', '17', '31']).join('、'), '3日、17日、31日');
  });

  test('schedule: formatTeacherName は「先生」の直前にスペースを入れる', function () {
    eq(S.formatTeacherName('山田愛実先生'), '山田愛実 先生');
    eq(S.formatTeacherName('山田 愛実先生'), '山田 愛実 先生');
  });

  test('schedule: formatTeacherName はすでにスペースがあれば増やさない', function () {
    eq(S.formatTeacherName('荒井 和真 先生'), '荒井 和真 先生');
  });

  test('schedule: formatTeacherName は「先生」が無ければそのまま返す', function () {
    eq(S.formatTeacherName('あぽろんオリジナル'), 'あぽろんオリジナル');
  });

  test('schedule: parseMonthNumber は「8月」→8、読めなければ null', function () {
    eq(S.parseMonthNumber('8月'), 8);
    eq(S.parseMonthNumber('12月'), 12);
    eq(S.parseMonthNumber('教科'), null);
    eq(S.parseMonthNumber(''), null);
  });

  test('schedule: actualDateOf は列の月+日でDateを組み立てる', function () {
    var today = new Date(2026, 7, 22);
    var d = S.actualDateOf(8, '17(A)', today);
    eq(d.getFullYear(), 2026);
    eq(d.getMonth(), 7);
    eq(d.getDate(), 17);
  });

  test('schedule: actualDateOf は「9/6」のような月明記を優先する', function () {
    var today = new Date(2026, 7, 22);
    var d = S.actualDateOf(8, '9/6', today);
    eq(d.getMonth(), 8);
    eq(d.getDate(), 6);
  });

  test('schedule: actualDateOf は年末年始の年またぎを正しく解決する', function () {
    var dec = new Date(2026, 11, 20);
    eq(S.actualDateOf(1, '10', dec).getFullYear(), 2027, '12月に見る1月は翌年');
    var jan = new Date(2027, 0, 5);
    eq(S.actualDateOf(12, '28', jan).getFullYear(), 2026, '1月に見る12月は前年');
  });

  test('schedule: actualDateOf は数字が無いトークンに null を返す', function () {
    eq(S.actualDateOf(8, 'おやすみ', new Date(2026, 7, 22)), null);
  });

  test('schedule: resolveLessonDates は過去/次/未来を付ける(今日以降の最初が next)', function () {
    var months = [
      { dateItems: ['3', '17', '31'], notes: [] },
      { dateItems: ['7', '14', '28'], notes: [] }
    ];
    var r = S.resolveLessonDates(['8月', '9月'], months, new Date(2026, 7, 22));
    eq(r[0][0].status, 'past', '8/3');
    eq(r[0][1].status, 'past', '8/17');
    eq(r[0][2].status, 'next', '8/31 が次のレッスン');
    eq(r[1][0].status, 'future', '9/7');
  });

  test('schedule: resolveLessonDates は今日がレッスン日なら today にする', function () {
    var months = [{ dateItems: ['22'], notes: [] }];
    var r = S.resolveLessonDates(['8月'], months, new Date(2026, 7, 22));
    eq(r[0][0].status, 'today');
    eq(r[0][0].daysUntil, 0);
  });

  test('schedule: resolveLessonDates は next に daysUntil(残り日数)を付ける', function () {
    var months = [{ dateItems: ['24', '31'], notes: [] }];
    var r = S.resolveLessonDates(['8月'], months, new Date(2026, 7, 22));
    eq(r[0][0].status, 'next');
    eq(r[0][0].daysUntil, 2);
  });

  test('schedule: formatDaysUntil は1日→明日、2日→明後日、それ以外は「あと◯日」', function () {
    eq(S.formatDaysUntil(1), '明日');
    eq(S.formatDaysUntil(2), '明後日');
    eq(S.formatDaysUntil(3), 'あと3日');
    eq(S.formatDaysUntil(7), 'あと7日');
  });

  test('schedule: resolveLessonDates は月が読めない列を unknown にする(落ちない)', function () {
    var months = [{ dateItems: ['5'], notes: [] }];
    var r = S.resolveLessonDates(['???'], months, new Date(2026, 7, 22));
    eq(r[0][0].status, 'unknown');
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

  // ------------------------------------------------------- instruments.js

  test('instruments: 主要な教科をアイコンに変換できる', function () {
    eq(I.iconForSubject('ピアノ科'), I.iconForSubject('ピアノ科・フルート科 新開講!'));
    ok(I.iconForSubject('ドラム科').length > 0, 'ドラム科のアイコンが取得できる');
    ok(I.iconForSubject('ボーカル科').length > 0, 'ボーカル科のアイコンが取得できる');
  });

  test('instruments: ギター系(エレキ/アコースティック/ベース/ウクレレ)は同じアイコン', function () {
    var g = I.iconForSubject('エレキギター科');
    eq(I.iconForSubject('アコースティックギター科'), g);
    eq(I.iconForSubject('エレキベース科'), g);
    eq(I.iconForSubject('ウクレレ科'), g);
  });

  test('instruments: 該当キーワードが無い教科は既定アイコンになる', function () {
    eq(I.iconForSubject('なぞの科'), I.DEFAULT_ICON);
    eq(I.iconForSubject(''), I.DEFAULT_ICON);
  });

  test('instruments: iconForSubjects は先頭の教科を優先する', function () {
    eq(I.iconForSubjects(['ピアノ科', 'ドラム科']), I.iconForSubject('ピアノ科'));
    eq(I.iconForSubjects([]), I.DEFAULT_ICON);
    eq(I.iconForSubjects(null), I.DEFAULT_ICON);
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
