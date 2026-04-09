@echo off
dir /s /b "C:\Users\WIN11-24H2GPT\WASSEL_USER_MANUAL.pptx" > "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\find-hero.txt" 2>&1
dir /s /b "C:\Users\WIN11-24H2GPT\Desktop\WASSEL_USER_MANUAL.pptx" >> "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\find-hero.txt" 2>&1
dir /s /b "C:\Users\WIN11-24H2GPT\Documents\WASSEL_USER_MANUAL.pptx" >> "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\find-hero.txt" 2>&1
dir /b "C:\Users\WIN11-24H2GPT\Desktop" >> "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\find-hero.txt" 2>&1
echo --- >> "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\find-hero.txt"
if exist "C:\Users\WIN11-24H2GPT\Desktop\HERO SKILL" echo FOUND HERO SKILL on Desktop >> "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\find-hero.txt"
if exist "C:\Users\WIN11-24H2GPT\Documents\HERO SKILL" echo FOUND HERO SKILL in Documents >> "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\find-hero.txt"
