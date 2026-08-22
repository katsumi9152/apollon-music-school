/**
 * app.js — 画面まわり(DOM 層)。教室 → 曜日 → 先生の順に選ぶと、レッスン日が表示される。
 * 前回選んだ教室・曜日・先生は localStorage に覚えておき、次回訪問時の初期値にする。
 */
(function (AMS) {
  'use strict';

  var C = AMS.constants;
  var S = AMS.schedule;
  var ST = AMS.storage;

  var els = {};
  var state = {
    storeId: null,
    weekday: null,
    teacher: null,
    data: null
  };

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function chipButton(label, selected, onClick) {
    var b = el('button', 'chip' + (selected ? ' chip-selected' : ''), label);
    b.type = 'button';
    b.setAttribute('aria-pressed', selected ? 'true' : 'false');
    b.addEventListener('click', onClick);
    return b;
  }

  function setStatus(text, tone) {
    els.status.textContent = text || '';
    els.status.className = 'status' + (tone ? ' status-' + tone : '');
    els.retryBtn.hidden = true;
  }

  function showLoadError(text) {
    setStatus(text, 'error');
    els.retryBtn.hidden = false;
  }

  // ---- 教室 ----

  function renderStores() {
    clear(els.storeList);
    for (var i = 0; i < C.STORES.length; i++) {
      (function (store) {
        var selected = state.storeId === store.id;
        els.storeList.appendChild(
          chipButton(store.name, selected, function () {
            selectStore(store.id);
          })
        );
      })(C.STORES[i]);
    }
  }

  function selectStore(storeId) {
    if (state.storeId === storeId && state.data) return;
    state.storeId = storeId;
    state.weekday = null;
    state.teacher = null;
    state.data = null;
    persistSelection();
    renderStores();
    els.weekdaySection.hidden = true;
    els.teacherSection.hidden = true;
    els.result.hidden = true;
    loadStoreData(storeId);
  }

  /**
   * 前回のキャッシュがあれば即座に表示し(体感速度優先)、裏で最新を取りに行って
   * 内容が変わっていた場合だけ静かに描画し直す。キャッシュが無ければ通常どおり待つ。
   */
  function loadStoreData(storeId) {
    var store = C.storeById(storeId);
    if (!store) return;

    var cached = ST.loadCache(storeId);
    var cachedText = cached && cached.csvText ? cached.csvText : null;

    if (cachedText) {
      applyScheduleData(storeId, S.parseSchedule(cachedText), 'cache');
    } else {
      setStatus('スケジュールを読み込み中…', 'loading');
      els.updatedInfo.textContent = '';
      clear(els.sheetLink);
    }

    var url = S.scheduleUrl(store.sheetId);
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.text();
      })
      .then(function (csvText) {
        if (state.storeId !== storeId) return; // 途中で教室が切り替わっていたら捨てる
        ST.saveCache(storeId, csvText);
        if (csvText === cachedText) {
          setStatus('', null); // 内容が同じなら再描画しない(点滅・スクロール防止)
          return;
        }
        applyScheduleData(storeId, S.parseSchedule(csvText), 'live');
      })
      .catch(function () {
        if (state.storeId !== storeId) return;
        if (cachedText) {
          setStatus('最新の情報を確認できませんでした。前回取得した内容を表示しています。', 'warn');
        } else {
          showLoadError('読み込みに失敗しました。電波の良い場所でもう一度試してね。');
        }
      });
  }

  function applyScheduleData(storeId, data, mode) {
    state.data = data;

    var store = C.storeById(storeId);

    if (mode === 'cache') {
      setStatus('最新のレッスン日を確認中…', 'loading');
    } else {
      setStatus('', null);
    }

    els.updatedInfo.textContent = data.updatedAt ? 'シート更新日: ' + data.updatedAt : '';

    clear(els.sheetLink);
    if (store.siteUrl) {
      var link = el('a', 'sheet-link-a', store.name + 'の公式サイトを見る');
      link.href = store.siteUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      els.sheetLink.appendChild(link);
    }

    var weekdays = S.weekdaysPresent(data.rows);
    if (weekdays.length === 0) {
      els.weekdaySection.hidden = true;
      els.teacherSection.hidden = true;
      els.result.hidden = true;
      setStatus('この教室のスケジュールを読み取れませんでした。', 'error');
      return;
    }

    els.weekdaySection.hidden = false;
    if (state.weekday && weekdays.indexOf(state.weekday) === -1) {
      state.weekday = null;
      state.teacher = null;
    }
    renderWeekdays(weekdays);

    if (state.weekday) {
      applyWeekday(state.weekday);
    } else {
      els.teacherSection.hidden = true;
      els.result.hidden = true;
    }
  }

  // ---- 曜日 ----

  function renderWeekdays(weekdays) {
    clear(els.weekdayList);
    for (var i = 0; i < weekdays.length; i++) {
      (function (w) {
        var selected = state.weekday === w;
        els.weekdayList.appendChild(
          chipButton(w + '曜日', selected, function () {
            selectWeekday(w);
          })
        );
      })(weekdays[i]);
    }
  }

  function selectWeekday(weekday) {
    state.weekday = weekday;
    state.teacher = null;
    persistSelection();
    renderWeekdays(S.weekdaysPresent(state.data.rows));
    applyWeekday(weekday);

    // 先生がまだ決まっていないときだけ、一覧が全部見えるようスクロールする
    if (!state.teacher && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(function () {
        if (typeof els.teacherSection.scrollIntoView === 'function') {
          els.teacherSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      });
    }
  }

  function applyWeekday(weekday) {
    var rows = S.rowsForWeekday(state.data.rows, weekday);
    els.teacherSection.hidden = false;
    renderTeachers(rows);

    var found = state.teacher ? findRow(rows, state.teacher) : null;
    if (found) {
      renderResult(found);
    } else {
      state.teacher = null;
      els.result.hidden = true;
    }
  }

  function findRow(rows, teacherName) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].teacher === teacherName) return rows[i];
    }
    return null;
  }

  // ---- 先生 ----

  function renderTeachers(rows) {
    clear(els.teacherList);
    for (var i = 0; i < rows.length; i++) {
      (function (row) {
        var selected = state.teacher === row.teacher;
        var label = S.formatTeacherName(row.teacher) +
          (row.subjects.length ? '(' + row.subjects[0] + ')' : '');
        els.teacherList.appendChild(
          chipButton(label, selected, function () {
            selectTeacher(row);
          })
        );
      })(rows[i]);
    }
  }

  function selectTeacher(row) {
    state.teacher = row.teacher;
    persistSelection();
    renderTeachers(S.rowsForWeekday(state.data.rows, state.weekday));
    renderResult(row);
  }

  // ---- 結果 ----

  function renderResult(row) {
    clear(els.result);
    els.result.hidden = false;

    var card = el('div', 'result-card');
    var top = el('div', 'result-top');
    var info = el('div', 'result-info');

    var store = C.storeById(state.storeId);

    var head = el('div', 'result-head');
    var badges = el('div', 'result-badges');
    if (store) badges.appendChild(el('span', 'result-badge result-badge-store', store.name));
    badges.appendChild(el('span', 'result-badge result-badge-weekday', row.weekday + '曜日'));
    if (row.subjects.length) {
      badges.appendChild(el('span', 'result-badge result-badge-subject', row.subjects[0]));
    }
    head.appendChild(badges);
    head.appendChild(el('h3', 'result-teacher', S.formatTeacherName(row.teacher)));
    info.appendChild(head);

    var icon = el('div', 'result-instrument', AMS.instruments.iconForSubjects(row.subjects));
    icon.setAttribute('aria-hidden', 'true');
    top.appendChild(info);
    top.appendChild(icon);
    card.appendChild(top);

    var monthLabels = state.data.monthLabels;
    var resolved = S.resolveLessonDates(monthLabels, row.months, new Date());
    var shown = 0;
    for (var m = 0; m < row.months.length; m++) {
      var month = row.months[m];
      if (month.dateItems.length === 0 && month.notes.length === 0) continue;
      shown++;
      var block = el('div', 'month-block');
      block.appendChild(el('div', 'month-label', monthLabels[m] || ('第' + (m + 1) + 'ヶ月')));

      if (month.dateItems.length) {
        var chips = el('div', 'date-chips');
        for (var d = 0; d < resolved[m].length; d++) {
          var item = resolved[m][d];
          var chip = el('span', 'date-chip date-' + item.status, S.formatDateItem(item.token));
          if (item.status === 'next') {
            chip.appendChild(el('span', 'date-tag', 'つぎ♪ あと' + item.daysUntil + '日'));
          } else if (item.status === 'today') {
            chip.appendChild(el('span', 'date-tag', 'きょう♪'));
          }
          chips.appendChild(chip);
        }
        block.appendChild(chips);
      } else {
        block.appendChild(el('div', 'month-dates', '(日程なし)'));
      }

      for (var n = 0; n < month.notes.length; n++) {
        block.appendChild(el('div', 'month-note', month.notes[n]));
      }
      card.appendChild(block);
    }
    if (shown === 0) {
      card.appendChild(el('div', 'month-note', 'この先生の日程は見つかりませんでした。'));
    }

    els.result.appendChild(card);
  }

  // ---- 保存・復元 ----

  function persistSelection() {
    ST.saveSelection({ storeId: state.storeId, weekday: state.weekday, teacher: state.teacher });
  }

  function restoreSelection() {
    var saved = ST.loadSelection();
    if (!saved) return;
    state.storeId = saved.storeId || null;
    state.weekday = saved.weekday || null;
    state.teacher = saved.teacher || null;
  }

  // ---- 初期化 ----

  function init() {
    els.storeList = document.getElementById('store-list');
    els.weekdaySection = document.getElementById('step-weekday');
    els.weekdayList = document.getElementById('weekday-list');
    els.teacherSection = document.getElementById('step-teacher');
    els.teacherList = document.getElementById('teacher-list');
    els.result = document.getElementById('result');
    els.status = document.getElementById('status');
    els.updatedInfo = document.getElementById('updated-info');
    els.sheetLink = document.getElementById('sheet-link');
    els.refreshBtn = document.getElementById('refresh-btn');
    els.retryBtn = document.getElementById('retry-btn');

    els.refreshBtn.addEventListener('click', function () {
      if (state.storeId) loadStoreData(state.storeId);
    });
    els.retryBtn.addEventListener('click', function () {
      if (state.storeId) loadStoreData(state.storeId);
    });

    restoreSelection();
    renderStores();
    if (state.storeId) {
      loadStoreData(state.storeId);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  AMS.app = { init: init };
})(this.AMS = this.AMS || {});
