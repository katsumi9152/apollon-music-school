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
$newToken = "$next-$sha"

$content = Get-Content -LiteralPath $indexPath -Raw
$match = [regex]::Match($content, '<p class="app-version">v([^<]+)</p>')
if (-not $match.Success) {
  throw 'index.html 内に <p class="app-version">v...</p> が見つかりませんでした。'
}
$oldToken = $match.Groups[1].Value

if ($oldToken -eq $newToken) {
  Write-Host "バージョンは既に最新です: v$newToken"
} else {
  $content = $content.Replace($oldToken, $newToken)
  Set-Content -LiteralPath $indexPath -Value $content -NoNewline
  Write-Host "v$oldToken -> v$newToken に更新しました(VERSION と index.html)"
}
