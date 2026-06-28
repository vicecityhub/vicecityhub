@echo off
cd /d "C:\Users\sarma\Documents\deployd\v10"
call npm run deploy
git add -A
git commit -m "feat: form scroll+focus on claim, sticky nav disabled during form fill"
git push origin main
echo DONE
