# Hcore Activation Panel

GitHub Pages + Cloudflare Worker based license activation system for Hcore.

## Files

| File | Purpose |
|-------|---------|
| `index.html` | Admin Panel UI |
| `style.css` | Dark theme styling |
| `app.js` | Admin panel logic |
| `keys.json` | License key database |
| `worker.js` | Cloudflare Worker API endpoint |

---

## Setup Guide

### Step 1: GitHub Repo

1. Go to [GitHub](https://github.com/new)
2. Create new repo: `hcore-panel` (public)
3. Upload all files: `index.html`, `style.css`, `app.js`, `keys.json`
4. Go to **Settings → Pages**
5. Source: **Deploy from a branch**
6. Branch: **main** / **(root)**
7. Save → Your panel is live at: `https://YOUR_USERNAME.github.io/hcore-panel`

### Step 2: GitHub Token

1. Go to [GitHub Settings → Developer Settings](https://github.com/settings/tokens)
2. **Personal access tokens → Fine-grained tokens**
3. **Generate new token**
4. Name: `hcore-panel`
5. Repository access: **Only select repositories** → `hcore-panel`
6. Permissions: **Contents → Read and Write**
7. **Generate token** → Copy it (`ghp_xxxxx`)

### Step 3: Cloudflare Worker

1. Go to [Cloudflare](https://dash.cloudflare.com/sign-up) → Create free account
2. Go to **Workers & Pages**
3. **Create application → Create Worker**
4. Name: `hcore-api`
5. **Deploy** (default code is fine, we'll replace it)
6. Click **Edit code**
7. Delete all default code
8. Paste contents of `worker.js`
9. Click **Save and deploy**

### Step 4: Configure Worker

1. In Cloudflare Dashboard → **Workers & Pages** → `hcore-api`
2. Go to **Settings → Variables and Secrets**
3. Add **Variable**:
   - Name: `GITHUB_RAW_URL`
   - Value: `https://raw.githubusercontent.com/YOUR_USERNAME/hcore-panel/main/keys.json`
   - Type: **Text**
4. **Save**
5. Your API is live at: `https://hcore-api.YOUR_USERNAME.workers.dev`

### Step 5: Configure Hcore

In your Hcore source code, find `nk.kt` and change:

```kotlin
// Original:
var ActivationUrl: String = "https://zerocheat.tech/connect.php"

// Change to:
var ActivationUrl: String = "https://hcore-api.YOUR_USERNAME.workers.dev"
```

### Step 6: Test

1. Open your admin panel: `https://YOUR_USERNAME.github.io/hcore-panel`
2. Enter GitHub username, repo name, and token
3. Click **Save Config**
4. Create a test key
5. Install Hcore APK on phone
6. Enter the key → Should activate!

---

## Admin Panel Features

- **Dashboard**: Total keys, active, expired, disabled counts
- **Create Key**: Generate or custom keys with expiry dates
- **Feature Toggles**: Daemon (feature1), Root Hide (feature2)
- **Server Modes**: Online, Maintenance, Offline
- **Key Management**: Edit, delete, search keys
- **Device Tracking**: Track how many devices activated per key

---

## API Response Format

### Success:
```json
{
  "status": "success",
  "expiry": "2026-12-31 23:59:59",
  "feature1": 1,
  "feature2": 1,
  "toggle_expiry": 1,
  "server_mode": "online"
}
```

### Fail:
```json
{
  "status": "fail",
  "reason": "Invalid license key"
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Panel shows "Connection failed" | Check GitHub token has Contents: Read/Write permission |
| Keys not saving | Check token is valid, repo name is correct |
| Worker returns 500 | Check GITHUB_RAW_URL variable is set correctly |
| Hcore activation fails | Make sure worker URL is correct in nk.kt |
| Keys.json not updating | Admin panel needs time to commit to GitHub |
