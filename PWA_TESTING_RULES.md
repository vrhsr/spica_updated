# PWA Testing Rules (NON-NEGOTIABLE)

## ⚠️ Critical Understanding

**A PWA is origin-scoped. Each origin has its own separate PWA:**

- `https://spicasg.in` = ONE PWA
- `https://preview.vercel.app` = DIFFERENT PWA  
- `http://localhost:9002` = DIFFERENT PWA

They do NOT share:
- Service workers
- Cache storage
- IndexedDB
- Installation state

## 🔒 The ONE RULE for PWA Testing

**Test PWA ONLY on production: `https://spicasg.in`**

### ❌ NEVER test PWA on:
- `*.vercel.app` preview URLs
- `localhost:9002` (dev server)
- Any other domain

Testing on multiple origins causes:
- Orphaned service workers
- Wrong controllers
- "SW exists but not controlling" state
- Phone ≠ laptop behavior
- Impossible-to-debug cache poisoning

## ✅ Correct Testing Procedure

### 1️⃣ One-Time Cleanup (MANDATORY before testing)

On every device (phone, laptop, tablet):

1. **Uninstall the PWA** if installed
2. **Clear all site data:**
   - Go to Chrome → Settings → Privacy → Site Settings → View permissions and data
   - Search for: `spicasg.in`
   - Click "Clear & reset"
   - Search for: `vercel.app`
   - Click "Clear & reset" for ALL Vercel URLs
3. **Restart Chrome completely**
4. **Clear browsing data** (optional but recommended):
   - Cookies and site data
   - Cached images and files

### 2️⃣ Fresh Installation

1. Visit **ONLY** `https://spicasg.in`
2. **Hard refresh:** Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
3. **Reload the page once more** (service worker takes over on 2nd load)
4. Open DevTools → Console
5. Check: `navigator.serviceWorker.controller`
   - Should be `null` on first load
   - Should show a `ServiceWorker` object after reload
6. **Install the PWA** using browser prompt or "Add to Home Screen"
7. **Reload once again**

### 3️⃣ Testing Offline Behavior

1. **First, verify online:**
   - PWA Debugger shows "Service Worker: Active"
   - PWA Debugger shows "Page Controller: Controlled"
   - Caches list shows: `app-shell`, `default-cache`, `pdf-cache`, `start-url`

2. **Save a presentation offline:**
   - Navigate to a doctor's page
   - Click "Save Offline"
   - Wait for download to complete
   - Verify "Offline Ready" badge appears

3. **Test offline mode:**
   - Enable Airplane Mode (phone) or toggle "Offline" in DevTools (laptop)
   - Navigate to `/rep/offline`
   - Verify saved presentations appear
   - Click "Present Now" to open a saved presentation
   - Verify PDF loads from IndexedDB (no network requests)

4. **Test offline boot:**
   - Close the PWA completely
   - Ensure device is still offline
   - Re-open the PWA
   - Should load `/rep/offline` or show offline.html fallback
   - Verify functionality works

## 🚫 Common Mistakes to AVOID

### ❌ Testing on preview URLs
**WRONG:** "Let me test on the Vercel preview before deploying"
**RIGHT:** Deploy to production `spicasg.in`, then test there

### ❌ Installing from multiple origins
**WRONG:** Install from `preview.vercel.app`, then visit `spicasg.in`
**RIGHT:** Only ever install from `spicasg.in`

### ❌ Testing in dev mode
**WRONG:** `npm run dev` and expect PWA to work
**RIGHT:** PWA is disabled in dev mode. Only test on production builds.

### ❌ Expecting instant service worker control
**WRONG:** Visit site once and expect offline to work
**RIGHT:** Service worker takes control on 2nd page load after registration

### ❌ Mixing old and new SW versions
**WRONG:** Update code, deploy, test immediately
**RIGHT:** Clear site data, hard refresh, reload, then test

## 🔧 Build & Deploy Workflow

### Development
```bash
npm run dev
# PWA is DISABLED
# Test features, UI, logic only
```

### Production Deployment
```bash
# 1. Commit changes
git add .
git commit -m "Fix PWA caching"
git push origin main

# 2. Wait for Vercel deployment to spicasg.in

# 3. Clear site data on test device

# 4. Visit https://spicasg.in ONLY

# 5. Hard refresh + reload

# 6. Test PWA
```

### Capacitor Build (mobile app)
The Android app now loads `https://spicasg.in` directly at runtime
(`capacitor.config.json` `server.url`) instead of a bundled static export —
there's no separate `build:capacitor` step anymore. Test it the same way as
the PWA above; the WebView just points at the live site.

## 📊 PWA Debugger Interpretation

The PWA Debugger shows critical state. Here's what to expect:

### ✅ Healthy PWA State
```
Network: Online ✓
Service Worker: Active ✓
Page Controller: Controlled ✓
Caches Found: 4
  • app-shell
  • default-cache
  • pdf-cache
  • start-url
```

### ⚠️ Unhealthy States

**State 1: No Controller**
```
Service Worker: Active
Page Controller: No Controller
```
**Fix:** Reload the page once

**State 2: Not Registered**
```
Service Worker: Not Registered
```
**Fix:** Hard refresh, or you're in dev mode

**State 3: Wrong Origin**
```
Service Worker: Active
Caches Found: 5
  • app-shell-spicasg  ← domain-specific cache name
  • workbox-precache-v2-https://preview.vercel.app/
```
**Fix:** You installed from the wrong origin. Clear all site data and reinstall from `spicasg.in`

## 🎯 The Final Mental Model

Think of PWA like a mobile app:

- You install the **iOS Mail app** from the **App Store**
- You don't install it from "beta.mail.com" and expect it to work on "mail.com"
- Each origin = each separate app

Your PWA is the same:
- **ONE origin** = `https://spicasg.in`
- **ONE installation source**
- **ONE production environment**

Preview URLs are like development builds of an iOS app — useful for testing logic, not for testing the final installed experience.

## 📝 Deployment Checklist

Before marking PWA as "production-ready":

- [ ] All testing done on `https://spicasg.in` only
- [ ] Service worker shows "Active" and "Controlled"
- [ ] Offline.html fallback works
- [ ] `/rep/offline` page loads offline
- [ ] PDFs save to IndexedDB successfully
- [ ] Saved presentations load offline
- [ ] PWA installs correctly on phone
- [ ] Device restart + offline boot works
- [ ] No references to `*.vercel.app` in runtime caching
- [ ] All team members cleared old installations

---

**Last Updated:** 2026-01-02  
**Critical Rule:** ONE domain (`spicasg.in`). ONE PWA. Period.
