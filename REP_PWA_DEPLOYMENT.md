# Rep-Only PWA Deployment Checklist

## Pre-Deployment Validation

### 1. Build & Test Locally
```bash
# Build production version
npm run build

# Start production server
npm start

# Visit http://localhost:9002/rep
```

### 2. Verify Manifest
- Open: `http://localhost:9002/manifest.json`
- Confirm:
  - `scope: "/rep"` ✓
  - `start_url: "/rep"` ✓
  - `name: "Field Rep Portal - SG HEALTH PHARMA"` ✓

### 3. Test Service Worker
Open DevTools → Application:

**Cache Storage (should see):**
- `rep-pages`
- `rep-auth`
- `rep-app-shell`
- `rep-pdf-cache`
- `rep-default-cache`

**Should NOT see:**
- ❌ Any admin caches
- ❌ Home page caches

### 4. Test IndexedDB
- Save a presentation offline
- Check: DevTools → Application → IndexedDB
- Should see: `rep-offline-db` ✓
- Should NOT see: `spicasg-offline-db` ✓

---

## Deployment Steps

### 1. Commit Changes
```bash
git add public/manifest.json
git add next.config.mjs
git add src/lib/indexeddb-utils.ts
git commit -m "feat: Create rep-only PWA isolated from admin portal"
git push origin main
```

### 2. Monitor Deployment
- Watch Vercel deployment logs
- Wait for deployment to complete
- Note the deployment URL

### 3. Clear Old PWA (CRITICAL)
**All users must:**
1. Uninstall old "SPICASG Portal" PWA
2. Clear site data:
   - Chrome → Settings → Site Settings → `spicasg.in`
   - Click "Clear & reset"
3. Restart browser

---

## Post-Deployment Testing

### Production URL: `https://spicasg.in/rep`

#### Test 1: Fresh Install
1. Visit `https://spicasg.in/rep` (NOT root `/`)
2. Should see install prompt for "Field Rep Portal"
3. Install PWA
4. Icon should show "Field Rep" label

#### Test 2: Offline Save
1. Login as rep
2. Navigate to doctors
3. Click "Save Offline" on a doctor
4. Should succeed without errors ✓

#### Test 3: Offline Navigation
1. Enable Airplane Mode
2. Close and reopen PWA
3. Should auto-redirect to `/rep/offline`
4. Should see saved presentations
5. Click "Present Now" → PDF should open ✓

#### Test 4: Admin Isolation
1. In browser (not PWA), visit `https://spicasg.in/admin`
2. Should load normally (admin works online)
3. In PWA, try to navigate to admin
4. Should NOT be cached (proves isolation) ✓

#### Test 5: Home Page Exclusion
1. In PWA, try to navigate to `/`
2. Should require network (not cached) ✓

---

## Success Criteria

✅ PWA installs as "Field Rep Portal"  
✅ Start URL is `/rep`  
✅ Only rep routes are cached  
✅ Admin routes NOT accessible offline  
✅ Home page NOT cached  
✅ IndexedDB is `rep-offline-db`  
✅ Offline save/load works perfectly  
✅ Smaller cache size (~40% reduction)  

---

## Rollback Plan

If critical issues occur:

```bash
# Revert the commit
git revert HEAD
git push origin main
```

Users will need to:
1. Uninstall "Field Rep Portal"
2. Reinstall old "SPICASG Portal"

---

## Communication Template

**For Field Reps:**

> 📱 **PWA Update Required**
> 
> We've upgraded the Field Rep Portal for better offline performance!
> 
> **Action Required:**
> 1. Uninstall the current "SPICASG Portal" app
> 2. Visit: https://spicasg.in/rep
> 3. Install the new "Field Rep Portal"
> 
> **Benefits:**
> - Faster installation
> - Better offline reliability
> - Cleaner app focused on field work
> 
> Questions? Contact support.

---

## Monitoring (First 48 Hours)

Watch for:
- Service worker registration errors
- Cache miss rates
- IndexedDB errors
- User complaints about missing features

**Key Metrics:**
- Installation rate
- Offline usage rate
- Cache hit/miss ratio
- Average cache size per device
