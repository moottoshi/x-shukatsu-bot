# デスクトップの keys.txt を読んで、GitHub の Secrets に登録する。
#
# キーをチャットや画面共有に出さずに済ませるためのスクリプト。
# 値はこの PC から GitHub へ直接送られる。
#
# 使い方:
#   1. メモ帳で下の4行を書いて、デスクトップに keys.txt という名前で保存する
#        X_API_KEY=(APIキー)
#        X_API_SECRET=(APIキーシークレット)
#        X_ACCESS_TOKEN=(アクセストークン)
#        X_ACCESS_SECRET=(アクセストークンシークレット)
#   2. このスクリプトを実行する
#        powershell -ExecutionPolicy Bypass -File scripts\set-secrets.ps1
#   3. 登録が終わると keys.txt は自動で削除される

param(
    # 省略時はデスクトップの key で始まる .txt を探す(keys.txt / key text.txt など)
    [string]$Path
)

$ErrorActionPreference = "Stop"

$repo = "moottoshi/x-shukatsu-bot"
$required = @("X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET")
$desktop = [Environment]::GetFolderPath("Desktop")

$keysPath = $Path
if (-not $keysPath) {
    $found = Get-ChildItem $desktop -Filter "key*.txt" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($found) { $keysPath = $found.FullName }
}

if (-not $keysPath -or -not (Test-Path $keysPath)) {
    Write-Host "キーを書いたテキストファイルが見つかりません。" -ForegroundColor Red
    Write-Host "探した場所: $desktop の key*.txt"
    exit 1
}

Write-Host "読み込むファイル: $keysPath"

# NAME=VALUE の形で読む。値に = が含まれても壊れないよう、最初の = だけで分割する
$values = @{}
foreach ($line in Get-Content $keysPath) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }

    $sep = $trimmed.IndexOf("=")
    if ($sep -lt 1) { continue }

    $name = $trimmed.Substring(0, $sep).Trim()
    $value = $trimmed.Substring($sep + 1).Trim()
    if ($value -ne "") { $values[$name] = $value }
}

$missing = $required | Where-Object { -not $values.ContainsKey($_) }
if ($missing.Count -gt 0) {
    Write-Host "keys.txt に足りない行があります: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "4行すべてを NAME=値 の形で書いてください。"
    exit 1
}

foreach ($name in $required) {
    # パイプで渡すと PowerShell が改行を付け足し、その改行ごと値として登録されてしまう。
    # スクリプト内の引数は PSReadLine の履歴に残らないので --body を使う
    $value = $values[$name]
    gh secret set $name --repo $repo --body $value
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$name の登録に失敗しました。" -ForegroundColor Red
        exit 1
    }
    Write-Host "$name を登録しました" -ForegroundColor Green
}

Remove-Item $keysPath -Force
Write-Host ""
Write-Host "4つとも登録しました。keys.txt は削除しました。" -ForegroundColor Cyan
