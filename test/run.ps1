# run.ps1 — テストをコマンドラインでまとめて実行する。
#
#   pwsh -File test\run.ps1
#
# Node もインストールも不要。Windows に最初から入っている Windows Script Host
# (cscript) の JavaScript エンジンでテストを走らせる。
# 対象は csv.js / schedule.js(DOM にも通信にも触れない純粋関数)のみ。
#
# すべて成功なら終了コード 0、1件でも失敗すれば 1 を返す。
# ブラウザで確認したい場合は test/index.html を開く。

$ErrorActionPreference = 'Stop'
$testDir = $PSScriptRoot
$root = Split-Path -Parent $testDir
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('ams-test-' + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null

if (-not (Get-Command cscript.exe -ErrorAction SilentlyContinue)) {
  Write-Host 'cscript.exe が見つかりません。ブラウザで test/index.html を開いて確認してください。' -ForegroundColor Yellow
  exit 2
}

function Invoke-Suite {
  param([string]$Title, [string[]]$Files, [string]$Entry)

  $resultFile = Join-Path $tmp ((New-Guid).ToString('N') + '.txt')
  $code = "var globalThis = this;`r`n"
  foreach ($f in $Files) {
    $path = Join-Path $root $f
    if (-not (Test-Path -LiteralPath $path)) { throw "テスト対象が見つかりません: $f" }
    $code += "`r`n;`r`n" + [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  }
  # ES3 エンジンは末尾カンマを受け付けないため、コメントを外してから取り除く
  $code = [regex]::Replace($code, '(?m)//[^\r\n]*', '')
  $code = [regex]::Replace($code, '(?s)/\*.*?\*/', '')
  $code = [regex]::Replace($code, ',(\s*[}\]])', '$1')

  $code += @"

;(function () {
  var r = $Entry.run();
  var lines = [];
  for (var i = 0; i < r.results.length; i++) {
    var t = r.results[i];
    lines[lines.length] = (t.ok ? 'PASS\t' : 'FAIL\t') + t.name + (t.ok ? '' : '\n         -> ' + t.message);
  }
  lines[lines.length] = 'SUMMARY\t' + r.passed + '\t' + r.total;
  var fso = new ActiveXObject('Scripting.FileSystemObject');
  var out = fso.CreateTextFile('$($resultFile.Replace('\', '\\'))', true, true);
  out.Write(lines.join('\r\n'));
  out.Close();
})();
"@

  $jsFile = Join-Path $tmp ((New-Guid).ToString('N') + '.js')
  [System.IO.File]::WriteAllText($jsFile, $code, [System.Text.UnicodeEncoding]::new($false, $true))

  Write-Host ''
  Write-Host "── $Title" -ForegroundColor Cyan

  $stderr = & cscript.exe //nologo //E:jscript $jsFile 2>&1
  if (-not (Test-Path -LiteralPath $resultFile)) {
    Write-Host '  実行中にエラーが発生しました:' -ForegroundColor Red
    $stderr | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    return @{ Passed = 0; Total = 0; Crashed = $true }
  }

  $passed = 0; $total = 0
  foreach ($line in (Get-Content -LiteralPath $resultFile -Encoding Unicode)) {
    if ($line -like 'SUMMARY*') {
      $p = $line -split "`t"
      $passed = [int]$p[1]; $total = [int]$p[2]
    } elseif ($line -like 'PASS*') {
      Write-Host ('  ✓ ' + ($line -replace "^PASS`t", '')) -ForegroundColor DarkGray
    } elseif ($line -like 'FAIL*') {
      Write-Host ('  ✗ ' + ($line -replace "^FAIL`t", '')) -ForegroundColor Red
    } else {
      Write-Host ('    ' + $line) -ForegroundColor Red
    }
  }
  $color = if ($passed -eq $total) { 'Green' } else { 'Red' }
  Write-Host "  $passed / $total passed" -ForegroundColor $color
  return @{ Passed = $passed; Total = $total; Crashed = $false }
}

try {
  $a = Invoke-Suite -Title '純粋関数 (test/tests.js)' `
    -Files @('test\es3-shim.js', 'src\constants.js', 'src\csv.js', 'src\schedule.js', 'test\tests.js') -Entry 'AMS.tests'
} finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

$passed = $a.Passed
$total = $a.Total
$failed = ($total - $passed) + $(if ($a.Crashed) { 1 } else { 0 })

Write-Host ''
if ($failed -eq 0 -and $total -gt 0) {
  Write-Host "==== 合計 $passed / $total passed ====" -ForegroundColor Green
  exit 0
} else {
  Write-Host "==== 合計 $passed / $total passed(失敗あり)====" -ForegroundColor Red
  exit 1
}
