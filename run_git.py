import os, subprocess, sys

repo = r"C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel"
lock = os.path.join(repo, ".git", "index.lock")

# Remove lock
if os.path.exists(lock):
    os.remove(lock)
    print("Lock removed")
else:
    print("No lock found")

os.chdir(repo)

files = [
    "client/src/pages/Campaigns.tsx",
    "client/src/pages/CampaignWizard.tsx",
    "client/src/pages/CampaignDetail.tsx",
    "client/public/locales/ar/translation.json",
    "client/public/locales/en/translation.json",
]

result = subprocess.run(["git", "add"] + files, capture_output=True, text=True)
print("git add:", result.returncode, result.stdout, result.stderr)

msg = "fix: campaign system overhaul - smooth Waalaxy-like flow\n\n- CampaignWizard: use /api/cloud/campaign/:id/launch instead of updateStatus\n- CampaignWizard: check LinkedIn session before launch (not extension detection)\n- CampaignDetail: remove dead /tick polling (cron handles all execution)\n- CampaignDetail: fix hardcoded Arabic strings with i18n t() keys\n- CampaignDetail: remove debug Test Automation button\n- Campaigns list: add status tabs (Running/Paused/Draft/Archived) with counts\n- Campaigns list: add search + quick pause/resume per campaign card\n- Translations: add 25+ missing AR/EN keys\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

result = subprocess.run(["git", "commit", "-m", msg], capture_output=True, text=True)
print("git commit:", result.returncode)
print(result.stdout)
print(result.stderr)

result = subprocess.run(["git", "push", "origin", "master"], capture_output=True, text=True)
print("git push:", result.returncode)
print(result.stdout)
print(result.stderr)

# Write result to file
with open(r"C:\Users\WIN11-24H2GPT\Desktop\git_result.txt", "w") as f:
    f.write("DONE\n")
    f.write(f"push exit: {result.returncode}\n")
    f.write(result.stdout + "\n")
    f.write(result.stderr + "\n")

print("All done!")
