# GitHub Interview Task PR Workflow

## When to Use
When submitting a take-home assignment or interview task PR to an open-source project you've forked.

## Key Scenario: Unrelated Histories

**Problem**: Local repo has different commit history than the remote (fork), causing:
```
fatal: refusing to merge unrelated histories
error: failed to push some refs to 'https://github.com/...'
```

**Root Cause**: You created a new repo with your changes, but the remote already has the original project's full history.

## Solution: Force Push After Cleanup

```bash
cd /path/to/interview-project

# 1. Abort any in-progress merge
wgit merge --abort

# 2. Clean untracked files (optional, if you have temp files)
wgit clean -fd

# 3. Verify your commits
wgit log --oneline -3

# 4. Force push to your fork
wgit push -u origin main --force
```

## Why --force is OK Here

- You're pushing to YOUR fork only
- The fork was created by you from the original repo
- Force push replaces the fork's history with yours
- Original repo is unaffected

## Pre-Push Cleanup Checklist

Before force pushing, ensure:

1. **Remove AI tool configs** from git tracking:
   ```bash
   # Add to .gitignore
   echo ".agents/" >> .gitignore
   echo ".claude/" >> .gitignore
   
   # Remove from git index
   wgit rm -r --cached .agents .claude 2>/dev/null
   ```

2. **Delete actual directories** (if they exist):
   ```bash
   rm -rf .agents .claude
   ```

3. **Commit the cleanup**:
   ```bash
   wgit add .
   wgit commit -m "chore: remove AI tool configs from repo"
   ```

4. **Verify no extra files**:
   ```bash
   wgit status --short
   # Should only show your feature files
   ```

## Common Mistakes to Avoid

| Mistake | Why it fails | Fix |
|---------|-------------|-----|
| `git pull` without `--allow-unrelated-histories` | Refuses to merge | Use `--force` push instead |
| `git pull --allow-unrelated-histories` then conflicts | Merge conflicts in config files | Abort merge, use force push |
| Forgetting `--force` | "Updates were rejected" | Add `--force` flag |
| Pushing .agents/.claude | Unnecessary files in PR | Add to .gitignore and remove |
| Multiple commits | Messy history | Squash to single commit before pushing |

## Creating the PR

After force push succeeds:

### Finding the "Create Pull Request" Button

1. Go to your fork on GitHub
2. You'll see a **"Compare & pull request"** button near the branch selector
3. Or go directly to: `https://github.com/original-owner/repo/pulls/new`
4. **Scroll to the BOTTOM** of the compare page to find the green **"Create pull request"** button

### PR Page Layout

After clicking "Create pull request", you'll see:

```
┌─────────────────────────────────────────────┐
│ Title: [feat: add new feature      ]        │
├─────────────────────────────────────────────┤
│ Description:                                │
│ ┌─────────────────────────────────────────┐ │
│ │  Markdown editor area                   │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ [Delete branch]  [Close pull request]       │
│                                             │
│ [Create pull request] ← Green button here  │
└─────────────────────────────────────────────┘
```

Right sidebar has:
- Reviewers
- Assignees
- Labels
- Projects
- Milestones

## Example PR Description Template

```markdown
## What
[One-line description of the feature]

## Technical Details
- Tech stack used
- Architecture decisions
- Key components added

## Design Decisions
- Why X over Y
- Trade-offs considered

## Testing
Commands to test locally

## Files Changed
List of modified/added files
```
