# deploy.ps1 - Build + deploy to gh-pages + commit + push main
param([string]$msg = "chore: deploy update")

Set-Location "C:\Users\sarma\Documents\deployd\v10"

Write-Host "Building and deploying to GitHub Pages..." -ForegroundColor Cyan
npm run deploy
if ($LASTEXITCODE -ne 0) { Write-Host "Deploy failed!" -ForegroundColor Red; exit 1 }

Write-Host "Committing to main..." -ForegroundColor Cyan
git add -A
$hasChanges = git status --porcelain
if ($hasChanges) {
    git commit -m $msg
    git push origin main
    Write-Host "Pushed to main." -ForegroundColor Green
} else {
    Write-Host "Nothing to commit." -ForegroundColor Yellow
}

Write-Host "All done!" -ForegroundColor Green
