# あぽろん レッスン日程

あぽろんミュージックスクールの生徒さん向け、レッスン日確認アプリ。教室 → 曜日 → 先生を選ぶと、レッスン日(と教科)が表示されます。フレームワーク・ビルド不要の HTML + JavaScript 単体構成です。

## 使い方

1. `https://<公開先>/` を開く(スマホならブックマークがおすすめ)
2. 教室 → 曜日 → 先生を選ぶ
3. レッスン日が表示される

前回選んだ教室・曜日・先生は、その端末のブラウザに保存され、次回開いたときの初期状態になります(SPEC的な話ではなく `localStorage` に保存しているだけで、他の人には共有されません)。

レッスンの時間帯(何時から)は各店舗のスケジュール表に載っていないため、このアプリでも扱っていません。時間の確認は教室に直接お問い合わせください。

## 開発

各店舗のスケジュールは、あぽろんミュージックスクールの公式サイト([sites.google.com/site/apollonmusicschool](https://sites.google.com/site/apollonmusicschool/home))に埋め込まれている Google スプレッドシートを、ブラウザから直接(CSV として)読み込んでいます。サーバーは持たず、データは毎回リアルタイムに取得します。

この方式は Google 側の CORS 設定に依存しており、`file://` で `index.html` を直接開くと読み込みに失敗します。確認する場合は簡易サーバーを使ってください。

```powershell
pwsh -File serve.ps1              # http://localhost:8765/
pwsh -File serve.ps1 -Any         # 同じ Wi-Fi のスマホからも確認したいとき
```

## キャッシュ対策とバージョン表示

`index.html` の `<script>` / `<link>` にはすべて `?v=YYYYMMDDx` を付けている(GitHub Pages のキャッシュを回避するため)。`styles.css` や `src/*.js` を1文字でも変えたら、このバージョン文字列を全箇所まとめて上げること(sed 等で一括置換)。上げ忘れると「直したのに反映されない」ように見える。画面下の `.app-version` にも同じ文字列を表示しているので、実機で最新が反映されているか確認できる。

## テスト

Node もインストールも不要です。Windows 同梱の Windows Script Host(cscript)で、CSV 解析・スケジュール解析の純粋関数を検証します。

```powershell
pwsh -File test\run.ps1
```

`test/index.html` をブラウザで開いても同じテストが走ります。

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面の骨格(教室→曜日→先生の3ステップ + 結果カード) |
| `styles.css` | 音楽教室らしい、明るく読みやすい見た目。スマホ表示を優先 |
| `src/constants.js` | 店舗一覧(店舗名とスプレッドシートID)・曜日順の一元管理 |
| `src/csv.js` | CSV パーサー(引用符内の改行・カンマ・エスケープに対応した純粋関数) |
| `src/schedule.js` | スプレッドシートの行を曜日・先生・日程・教科に解析する純粋関数 |
| `src/instruments.js` | 教科名から楽器アイコン(絵文字)を選ぶ純粋関数 |
| `src/storage.js` | 前回の選択・取得したデータの `localStorage` への保存/読込 |
| `src/app.js` | DOM 層(店舗選択・データ取得・描画・イベント処理) |

`src/app.js` 以外は DOM にも通信にも触れない純粋関数の層です。

## 店舗を追加・変更するには

`src/constants.js` の `STORES` に `{ id, name, sheetId }` を足すだけです。`sheetId` は、その店舗の Google スプレッドシートの URL(`https://docs.google.com/spreadsheets/d/<ここ>/edit`)から取得します。シートの列構成(曜日・講師・月×2・教科)が他店舗と同じであることが前提です。
