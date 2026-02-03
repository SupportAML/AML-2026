# Quick Git History Cleanup Guide
# Use this if you want to manually clean the history

## OPTION 1: Using BFG Repo-Cleaner (RECOMMENDED - Fast & Safe)

### Install BFG
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
# Or use package manager:
choco install bfg-repo-cleaner
# OR
scoop install bfg

### Run BFG Cleanup
cd "d:\SSD DATA\Projects\copy-of-apexmedlaw-working-before-merger-2"

# Replace all secrets with ***REMOVED***
bfg --replace-text secrets-to-remove.txt

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Verify
git log --all -S "AIzaSyBPMLqxe3oELGXut9QD6vbHYpnadW_nVd0"
# Should return nothing

# Force push (⚠️ REWRITES HISTORY)
git push origin --force --all


## OPTION 2: Manual Method (If BFG not available)

### Step 1: Create backup
git tag backup-before-cleanup-$(Get-Date -Format 'yyyyMMdd-HHmmss')

### Step 2: Remove files from history
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch firebase.ts config.ts" --prune-empty --tag-name-filter cat -- --all

### Step 3: Clean up
git reflog expire --expire=now --all  
git gc --prune=now --aggressive

### Step 4: Re-add the files with new content (already done)
# The current versions use environment variables

### Step 5: Force push
git push origin --force --all


## OPTION 3: Nuclear Option - Squash All History

### Only if above methods don't work
git checkout --orphan fresh-start
git add -A
git commit -m "Initial commit with secured code (history cleaned)"
git branch -D master
git branch -m master
git push origin master --force


## After Any Method:

### 1. Verify secrets are gone
git log --all --full-history -S "AIzaSyBPMLqxe3oELGXut9QD6vbHYpnadW_nVd0"
git grep -i "AIzaSyBPMLqxe3oELGXut9QD6vbHYpnadW_nVd0" $(git rev-list --all)

### 2. Team members need to refresh
git fetch origin
git reset --hard origin/master

### 3. IMPORTANT: Rotate all keys immediately!
# See SECURITY_CLEANUP.md for detailed instructions
