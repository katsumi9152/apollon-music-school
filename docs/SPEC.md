# あぽろん レッスン日程 — 仕様書

対象読者: このリポジトリを保守・改修する開発者。
非エンジニア向けの説明資料は別途「あぽろんレッスン日程_取扱説明書.pptx」を参照。
`README.md` は開発環境のセットアップ・実行手順が中心。本書はアプリの内部仕様(データフロー・モジュール契約・状態管理・制約)をまとめたもの。

最終更新: 2026-08-22 / 対象バージョン: `v20260823u`

## 1. 概要

生徒・保護者・教員が、あぽろんミュージックスクール各教室のレッスン日程を確認するための非公式 Web アプリ。教室 → 曜日 → 先生の3ステップで、次のレッスン日を表示する。

- ビルド不要・フレームワーク不要の素の HTML / CSS / JavaScript (ES5 相当)。
- 専用バックエンドを持たない。データは Google スプレッドシートから毎回クライアント側で直接取得する。
- 静的ファイルのみで完結するため、任意の静的ホスティング(GitHub Pages 等)で配信できる。

## 2. アーキテクチャ

```
                 ブラウザ
  ┌───────────────────────────────────────────┐
  │  index.html                                │
  │   ├─ styles.css                            │
  │   └─ src/*.js (依存順に <script> で読込)     │
  │        constants.js → csv.js → schedule.js │
  │        → instruments.js → storage.js       │
  │        → app.js (最後に DOM 初期化)          │
  └───────────────────────────────────────────┘
                     │ fetch (実行時)
                     ▼
  Google スプレッドシート (店舗ごと・公開設定)
    https://docs.google.com/spreadsheets/d/<sheetId>/gviz/tq?tqx=out:csv
```

サーバーサイドの処理・データベース・認証は存在しない。すべての計算はブラウザ内で完結する。

### レイヤー構成

| ファイル | 役割 | DOM/通信への依存 |
|---|---|---|
| `src/constants.js` | 店舗一覧・曜日順・localStorage キー名の一元管理 | なし |
| `src/csv.js` | RFC4180 相当の CSV パーサー(引用符内改行・カンマ・エスケープ対応) | なし(純粋関数) |
| `src/schedule.js` | CSV 行列 → スケジュールデータへの変換・日付解決 | なし(純粋関数) |
| `src/instruments.js` | 教科名 → 楽器アイコン(絵文字)の対応表 | なし(純粋関数) |
| `src/storage.js` | `localStorage` の読み書き(try/catch でラップ) | `localStorage` のみ |
| `src/app.js` | DOM 生成・イベント処理・`fetch` 呼び出し・状態管理 | DOM + `fetch` + 上記全モジュール |

`AMS` というグローバル名前空間(`this.AMS = this.AMS || {}`)の下に、各ファイルが `AMS.constants` / `AMS.csv` / `AMS.schedule` / `AMS.instruments` / `AMS.storage` / `AMS.app` としてモジュールを公開する、IIFE + 名前空間パターン。`type="module"` は使用していない(`test/run.ps1` が cscript の ES3 相当エンジンで直接実行するため。3章参照)。

## 3. 実行環境の制約(ES3 相当への配慮)

`test/run.ps1` は Node.js を使わず、Windows 同梱の `cscript.exe`(JScript / ES3 エンジン)でテストを実行する。そのため `src/csv.js` `src/schedule.js` `src/instruments.js` `src/constants.js` は **意図的に ES3 相当の構文**で書かれている。

- `var` のみ使用(`let` / `const` 不使用)
- 末尾カンマ禁止(テストランナーが正規表現でカンマを取り除くため、末尾カンマがあると壊れる)
- アロー関数・テンプレートリテラル・`Array.prototype.includes` 等の ES6+ API 不使用
- 絵文字は `String.fromCharCode` によるサロゲートペア手動生成(`src/instruments.js`)。`String.fromCodePoint` は ES3 に無いため使用しない
- ソース中に `"//"` を連続させない(`test/run.ps1` の正規表現 `(?m)//[^\r\n]*` がコメントとして誤って除去してしまうため)。`scheduleUrl` の URL 文字列は `'https:' + '/' + '/...'` のように分割して記述している

**この制約に従わないコードを `src/` 配下に追加すると、`test/run.ps1` によるテストが実行時エラーで落ちる。** `src/app.js` は DOM 層でありテスト対象外のため、この制約の対象外。ただし将来的な一貫性のため同様のスタイルを踏襲している。

## 4. データモデル

### 4.1 店舗定義 (`AMS.constants.STORES`)

```js
{
  id: string,        // 内部識別子。localStorage キーにも使う
  name: string,       // 表示名(例: "新潟店")
  sheetId: string,    // Google スプレッドシートの ID
  sitePath: string,   // 公式サイト内のパス
  siteUrl: string,    // 実行時に SITE_BASE + sitePath で自動生成
}
```

現在7店舗(新潟店 / 新潟東区役所店 / 新潟駅南店 / イオン新潟西店 / イオンモール新発田店 / 長岡店 / 三条店)。**店舗を追加・変更する場合は `src/constants.js` の `STORES` 配列に1件追加するのみでよい。** ただし対象スプレッドシートの列構成が下記4.2と一致している必要がある。

### 4.2 スプレッドシートの想定フォーマット

全店舗共通の列構成(1行目付近にヘッダー行があり、A列が `"曜日"` で始まる行を検出する):

| 列 | 内容 |
|---|---|
| A | 曜日(結合セル相当。同じ曜日が続く間は2行目以降が空欄) |
| B | 講師名(複数行の場合はスペース区切りで連結) |
| C | 月1のレッスン日(カンマ区切り、`※` で始まる行は注記として分離) |
| D | 月2のレッスン日(同上) |
| E | 教科(楽器名を含む文字列。複数ある場合は改行区切り) |

- レッスンの時間帯を表す列は存在しない → アプリでも扱わない。
- 更新日はシート冒頭6行以内を走査し、`YYYY/M/D 更新` のパターンを正規表現で抽出する(`extractUpdatedAt`, `src/schedule.js`)。

### 4.3 パース後のスケジュール行 (`AMS.schedule.parseSchedule` の戻り値)

```js
{
  updatedAt: string,       // "2026/8/12" のような文字列。抽出できなければ ""
  monthLabels: [string, string],  // 例: ["8月", "9月"]
  rows: [
    {
      weekday: string,       // "月" など(前方補完済み)
      teacher: string,       // 講師名(生の値。表示直前まで整形しない)
      subjects: string[],    // 教科名の配列
      months: [
        { dateItems: string[], notes: string[] },  // 月1
        { dateItems: string[], notes: string[] },  // 月2
      ],
    },
    // ...
  ],
}
```

### 4.4 日付解決 (`AMS.schedule.resolveLessonDates`)

`dateItems`("10", "17(A)", "9/6" 等の文字列)を実際の `Date` に変換し、当日を基準に状態を付与する。

- 年の推定: 対象月と `today` の月差が ±6 を超える場合は前後年とみなす(例: 12月に "1月" 列を見たら翌年扱い)。
- 存在しない日付(例: `2/30`)は `Date` オブジェクトの自動繰り上げによる誤判定を避けるため、`day > daysInMonth(year, month)` で弾いて `null` を返す。
- 全日付のうち「今日以降で最も近い1件」だけに `status: 'next'`(当日なら `'today'`)と `daysUntil` を付与する。それ以外は `'past'` / `'future'` / (日付を読み取れない場合)`'unknown'`。

### 4.5 localStorage スキーマ (`AMS.storage`, キー定義は `AMS.constants.STORAGE_KEYS`)

| キー | 内容 | 形式 |
|---|---|---|
| `ams-schedule:last-selection` | 前回選択した `{storeId, weekday, teacher}` | JSON文字列 |
| `ams-schedule:cache:<storeId>` | 店舗ごとの直近取得 CSV `{csvText, fetchedAt}` | JSON文字列 |
| `ams-schedule:theme` | `"light"` \| `"dark"` | 文字列 |

いずれも `try/catch` でラップされ、`localStorage` が使用不可(プライベートブラウジング等)でも例外を投げずに `null` を返す・書き込みを黙って諦める設計。個人情報(氏名・連絡先等)は保存対象に含まれない。

## 5. データ取得フロー (`loadStoreData`, `src/app.js`)

```
                      ┌─ キャッシュあり ──► 即座に画面へ反映(mode:"cache")
選択が変わる ─► loadStoreData
                      └─ キャッシュなし ──► "読み込み中…" を表示

同時に必ず: fetch(scheduleUrl(sheetId))
   │
   ├─ 成功 & 曜日データを検出
   │     ├─ 内容がキャッシュと同一 → 何もしない(ちらつき防止)
   │     └─ 内容が異なる          → 画面を再描画 + キャッシュ更新(mode:"live")
   │
   ├─ 成功 & 曜日データを検出できない(一時的なエラーページ等)
   │     ├─ キャッシュあり → 警告文を表示、キャッシュは上書きしない
   │     └─ キャッシュなし → 空データのまま描画(store設定エラーとして表示)
   │
   └─ 失敗(ネットワークエラー等)
         ├─ キャッシュあり → 警告文を表示、キャッシュの内容のまま
         └─ キャッシュなし → エラー表示 + 再試行ボタン
```

`state.storeId` の変更を都度チェックし(`if (state.storeId !== storeId) return;`)、`fetch` の応答が返ってくる前に店舗が切り替えられていた場合は結果を破棄する(競合状態のガード)。

## 6. 状態管理 (`src/app.js`)

DOM 層はグローバルな `state` オブジェクト1つで管理する(Redux 等のライブラリは使用しない)。

```js
state = {
  storeId: string|null,
  weekday: string|null,
  teacher: string|null,
  data: ParsedSchedule|null,  // 4.3 の parseSchedule 戻り値
}
```

選択が変わるたびに `persistSelection()` で `localStorage` に反映する。初期化時 (`restoreSelection`) に前回値を読み込み、該当データ取得後に曜日・先生の再選択を試みる(存在しなくなっていればリセット)。

## 7. UI 描画方針

- DOM 生成は `document.createElement` + `textContent` のみ(`el()` ヘルパー、`src/app.js`)。**`innerHTML` は一切使用しない。** これはスプレッドシートの内容(外部の書き込み可能なデータソース)をそのまま画面へ出す構成であるため、XSS を構造的に防ぐための意図的な設計。今後変更する場合もこの方針を維持すること。
- 教室・曜日・先生のチップ一覧はすべて `renderChipList()` 共通関数で描画し、選択判定・ラベル・クリック時処理だけを呼び出し側で差し替える。
- ライト/ダーク表示は `document.documentElement` の `data-theme` 属性で切り替え、`styles.css` 側の CSS カスタムプロパティ(`:root` / `prefers-color-scheme: dark` / `[data-theme="dark"]`)で色を出し分ける。ユーザーが明示的に切り替えた場合のみ `localStorage` に保存し、未設定時は OS 設定(`prefers-color-scheme`)に従う。

## 8. 対応環境・非対応環境

- **対応**: `fetch` / `Promise` / `localStorage` / `matchMedia` / `requestAnimationFrame` を実装したモダンブラウザ(Safari, Chrome, Edge 等)。JavaScript 有効が前提。
- **file:// で直接開くと動作しない**: `docs.google.com` への `fetch` が CORS ポリシーにより拒否される。`http(s)://` 経由(`serve.ps1` によるローカル配信、または GitHub Pages 等の静的ホスティング)が必須。
- レスポンシブ対応だが、スマートフォン表示を優先したデザイン(`.page { max-width: 520px }`)。

## 9. キャッシュバスティング運用ルール

`index.html` の `<link>` / `<script>` タグはすべて `?v=YYYYMMDDx` を付与している(GitHub Pages 等のキャッシュを回避するため)。`styles.css` または `src/*.js` を1文字でも変更した場合、**この文字列を全箇所まとめて上げること**。フッターの `.app-version` にも同じ文字列を表示しており、実機で最新版が反映されているかの確認に使う。上げ忘れると「直したのに反映されない」不具合に見える。

## 10. テスト

`test/tests.js` に `csv.js` / `schedule.js` / `instruments.js` / `constants.js`(いずれも純粋関数のみ)のユニットテストがある(現在39件)。`src/app.js`(DOM 層)は自動テスト対象外。

```powershell
pwsh -File test/run.ps1      # cscript(ES3エンジン)で実行、CIでも使える
# または test/index.html をブラウザで開いても同じテストが走る
```

## 11. セキュリティ上の考慮事項

- **XSS**: 7章のとおり `innerHTML` を使わない設計により、スプレッドシート側に不正な文字列が混入しても実行されない。
- **秘密情報**: API キー・認証情報の類はコード中に存在しない。
- **スプレッドシート ID の露出**: `src/constants.js` に各店舗の `sheetId` が平文で埋め込まれる(クライアント実行のため構造上避けられない)。**該当 Google スプレッドシートの共有設定が「閲覧のみ」になっていることが前提。** 誤って編集可能な共有設定になっている場合、この ID から直接スプレッドシート本体(他のシートやセル・変更履歴を含む)にアクセスされ得る。運用側(スプレッドシート管理者)での定期確認を推奨。
- **個人情報**: 生徒の氏名・連絡先・出欠等は一切扱わない。表示されるのは公開スケジュール表由来の情報(教室・曜日・講師名・日付・教科)のみ。

## 12. 既知の制限(技術的観点)

- レッスンの時間帯を表すデータがスプレッドシート側に存在しないため、アプリでも表示しない。
- スプレッドシートの列構成・見出し文言が変わると `findHeaderRowIndex` / `parseSchedule` が正しく検出できなくなる(サイレントに空データ扱いになる場合がある)。
- 複数店舗の横断検索・生徒名での検索機能はない(1店舗ずつ選択する UI 構造)。
- 認証・アカウントの概念がなく、URL を知っていれば誰でも同じ情報を閲覧できる(公開スプレッドシートと同等の扱い)。
- Google 側の `gviz/tq` エンドポイント仕様変更や、スプレッドシートの公開設定変更は、アプリ側では検知・通知できない(2章のデータ取得フローに従いエラー表示 or キャッシュ表示にフォールバックするのみ)。

## 13. 変更時のチェックリスト

1. `src/` を変更したら `pwsh -File test/run.ps1` を実行し、39件すべて成功することを確認する。
2. `styles.css` / `src/*.js` を変更したら `index.html` 内の `?v=` を全箇所一括で上げる(9章)。
3. `src/csv.js` `src/schedule.js` `src/instruments.js` `src/constants.js` を変更する場合は、3章の ES3 相当の制約(`let`/`const` 不使用、末尾カンマ禁止、`"//"` の連続禁止 等)を守る。
4. 店舗を追加する場合は `src/constants.js` の `STORES` に1件追加し、対象スプレッドシートの列構成が4.2と一致しているか確認する。
5. DOM へ値を差し込む処理を追加する場合は `innerHTML` を使わず `textContent` / `createElement` を使う(7章・11章)。
