@echo off
cd /d "C:\Users\sarma\Documents\deployd\v10"
call npm run deploy
git add -A
git commit -m "fix: form scrollMarginTop 148px + mobile grid-cols-1 on form fields"
git push origin main
echo DONE
