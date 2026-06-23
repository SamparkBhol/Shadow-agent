/**
 * Ordered command scripts used by guided mode. Each scenario walks the user
 * through a common workflow one command at a time.
 */

export const SEED_SCENARIOS: Record<string, string[]> = {
  "git-loop": [
    "git status",
    "git add .",
    'git commit -m "update"',
    "git push",
  ],
  "dev-loop": ["npm install", "npm run dev", "npm run build", "npm test"],
  inspect: ["ls", "cat package.json", "grep -r TODO src", "cd src", "ls"],
  deploy: [
    "git pull",
    "npm run build",
    "vercel --prod",
    "curl https://app.example.com/health",
  ],
  branch: [
    "git checkout -b feature/x",
    "git status",
    "git add .",
    'git commit -m "wip"',
    "git checkout main",
    "git merge feature/x",
  ],
};
