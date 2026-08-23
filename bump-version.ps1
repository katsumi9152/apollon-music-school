# bump-version.ps1 — キャッシュ対策バージョン文字列を一括更新する
#
#   pwsh -File bump-version.ps1
#
# styles.css や src/*.js を1文字でも変えたら、コミット前にこれを実行すること。
# 手作業で v=... を7箇所書き換えると「1箇所だけ上げ忘れる」事故が起きるため、
# 「VERSION ファイル(コミットする永続カウンター)を1つ進め、index.html 内の
# バージョン文字列は全て index.html 自身から現在値を読み取って一括置換する」
# という、書き手が1つだけになる方式にしている。
#
# キャッシュ対策の ?v=... には確実性を優先してカウンター+git ハッシュを使う一方、
# 画面下の .app-version にはユーザー向けに「v1.00」のような読みやすい形式で表示する。
# この2つは値が違うため、置換は必ずそれぞれの文脈(?v="..." / <p class="app-version">...)
# に絞って行う。文字列全体を素朴に置換すると、たまたま値が一致していたときに
# 別の箇所を巻き込んで壊すことがある(実際に一度壊れたので、この形にした)。
#
# 埋め込む git のコミットハッシュは「このスクリプトを実行した時点の HEAD」であり、
# これから作る VERSION の更新コミットそのものではない(自己参照はできないため)。
# このアプリはビルド成果物を配布するわけではなく index.html がそのまま配信物なので、
# それで実用上問題ない。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$versionFile = Join-Path $root 'VERSION'
$indexPath = Join-Path $root 'index.html'

$current = 0
if (Test-Path $versionFile) {
  $text = (Get-Content -LiteralPath $versionFile -Raw).Trim()
  if ($text) { $current = [int]$text }
}
$next = $current + 1
Set-Content -LiteralPath $versionFile -Value $next -NoNewline

$sha = (git rev-parse --short HEAD 2>$null)
if (-not $sha) { $sha = 'nogit' }
$newCacheToken = "$next-$sha"

$major = [math]::Floor(($next - 1) / 100) + 1
$minor = ($next - 1) % 100
$newDisplayVersion = 'Version {0}.{1:D2} ({2})' -f $major, $minor, $sha

$content = Get-Content -LiteralPath $indexPath -Raw

$content = [regex]::Replace($content, '(\?v=)[^"]+(")', '${1}' + $newCacheToken + '$2')
$content = [regex]::Replace($content, '(<p class="app-version">)[^<]*(</p>)', '${1}' + $newDisplayVersion + '$2')

Set-Content -LiteralPath $indexPath -Value $content -NoNewline
Write-Host "$newDisplayVersion (キャッシュトークン: $newCacheToken) に更新しました"
