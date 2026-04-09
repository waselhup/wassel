@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
echo === GIT STATUS === > C:\Users\WIN11-24H2GPT\Desktop\git_result2.txt
git status >> C:\Users\WIN11-24H2GPT\Desktop\git_result2.txt 2>&1
echo === GIT LOG === >> C:\Users\WIN11-24H2GPT\Desktop\git_result2.txt
git log --oneline -5 >> C:\Users\WIN11-24H2GPT\Desktop\git_result2.txt 2>&1
echo === API PACKAGE === >> C:\Users\WIN11-24H2GPT\Desktop\git_result2.txt
type api\package.json >> C:\Users\WIN11-24H2GPT\Desktop\git_result2.txt 2>&1
