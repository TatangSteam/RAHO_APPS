# 🚀 Production Deployment Guide — Super Admin Impersonation Feature

## Overview

This guide provides step-by-step instructions for deploying the Super Admin Impersonation feature to production. Follow these steps carefully to ensure a smooth deployment.

**Feature:** Multi-Level Impersonation System  
**Version:** 1.0.0  
**Date:** May 15, 2026  
**Estimated Time:** 1 hour

---

## Pre-Deployment Checklist

Before deploying to production, ensure the following are complete:

- [x] All backend code implemented and tested
- [x] All frontend code implemented and tested
- [x] Unit tests passing
- [x] Integration tests passing
- [x] API documentation created (`docs/API-IMPERSONATION.md`)
- [x] Essential seed includes Super Admin user
- [ ] Security review completed
- [ ] Staging deployment tested
- [ ] Rollback plan prepared

---

## Deployment Steps

### Step 1: Database Migrations

**Status:** ✅ No migrations required

The Super Admin Impersonation feature does **NOT** require any database schema changes. All functionality uses existing tables and columns.

**Verification:**
```bash
# Check for pending migrations
cd apps/api
npx prisma migrate status
```

**Expected Output:** "Database schema is up to date!"

---

### Step 2: Run Essential Seed

**Purpose:** Create the Super Admin user in production database

**⚠️ IMPORTANT:** Only run this if the Super Admin user doesn't already exist in production.

#### 2.1 Check if Super Admin Exists

```bash
# SSH into production server
ssh user@production-server

# Navigate to API directory
cd /path/to/raho-api

# Check for existing Super Admin
npx prisma studio
# Or use psql/mysql client to query:
# SELECT * FROM "User" WHERE email = 'superadmin@raho.id';
```

#### 2.2 Run Essential Seed (if needed)

```bash
# On production server
cd /path/to/raho-api

# Set production environment
export NODE_ENV=production

# Run essential seed only
npm run seed:essential
```

**Expected Output:**
```
✅ Essential seed completed successfully
✅ Super Admin user created: superadmin@raho.id
```

#### 2.3 Verify Super Admin Credentials

**Email:** `superadmin@raho.id`  
**Password:** `Sup3r4dM1n`

**⚠️ SECURITY:** Change this password immediately after first login!

---

### Step 3: Deploy Backend

#### 3.1 Prepare Backend Build

```bash
# On your local machine or CI/CD pipeline
cd apps/api

# Install dependencies
npm install

# Run tests
npm test

# Build TypeScript
npm run build

# Verify build
ls -la dist/
```

#### 3.2 Deploy to Production Server

**Option A: Manual Deployment**

```bash
# Create deployment package
tar -czf api-deployment.tar.gz dist/ node_modules/ package.json prisma/

# Copy to production server
scp api-deployment.tar.gz user@production-server:/tmp/

# SSH into production
ssh user@production-server

# Extract and deploy
cd /path/to/raho-api
tar -xzf /tmp/api-deployment.tar.gz

# Restart API service
pm2 restart raho-api
# Or: systemctl restart raho-api
```

**Option B: CI/CD Pipeline**

```bash
# Trigger deployment pipeline
git tag -a v1.0.0-impersonation -m "Deploy Super Admin Impersonation"
git push origin v1.0.0-impersonation

# Monitor deployment
# Check your CI/CD dashboard (GitHub Actions, GitLab CI, Jenkins, etc.)
```

#### 3.3 Verify Backend Deployment

```bash
# Check API health
curl https://your-production-api.com/health

# Check impersonation endpoints
curl -H "Authorization: Bearer <super-admin-token>" \
  https://your-production-api.com/api/v1/admin/managers

# Expected: 200 OK with list of managers
```

---

### Step 4: Deploy Frontend

#### 4.1 Prepare Frontend Build

```bash
# On your local machine or CI/CD pipeline
cd apps/web

# Install dependencies
npm install

# Set production environment variables
export NEXT_PUBLIC_API_URL=https://your-production-api.com
export NODE_ENV=production

# Build Next.js application
npm run build

# Verify build
ls -la .next/
```

#### 4.2 Deploy to Production Hosting

**Option A: Vercel Deployment**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
cd apps/web
vercel --prod

# Follow prompts and confirm deployment
```

**Option B: Self-Hosted (PM2/Nginx)**

```bash
# Create deployment package
tar -czf web-deployment.tar.gz .next/ public/ package.json next.config.js

# Copy to production server
scp web-deployment.tar.gz user@production-server:/tmp/

# SSH into production
ssh user@production-server

# Extract and deploy
cd /path/to/raho-web
tar -xzf /tmp/web-deployment.tar.gz

# Restart Next.js service
pm2 restart raho-web
# Or: systemctl restart raho-web
```

**Option C: Static Export (if applicable)**

```bash
# Build static export
npm run build
npm run export

# Deploy to CDN/Static hosting
aws s3 sync out/ s3://your-bucket-name/ --delete
# Or: netlify deploy --prod --dir=out
```

#### 4.3 Verify Frontend Deployment

```bash
# Check homepage
curl https://your-production-web.com

# Check Super Admin page
curl https://your-production-web.com/admin/super-admin

# Expected: 200 OK
```

---

### Step 5: Monitor Logs

#### 5.1 Backend Logs

```bash
# SSH into production server
ssh user@production-server

# Tail API logs
pm2 logs raho-api --lines 100
# Or: tail -f /var/log/raho-api/error.log

# Watch for errors
grep -i "error\|exception\|impersonation" /var/log/raho-api/app.log
```

**What to look for:**
- ✅ No authentication errors
- ✅ No impersonation service errors
- ✅ Successful audit log entries
- ❌ Any 500 errors
- ❌ JWT token errors

#### 5.2 Frontend Logs

```bash
# Check Next.js logs
pm2 logs raho-web --lines 100

# Check browser console (via monitoring tools)
# - Sentry
# - LogRocket
# - Datadog RUM
```

#### 5.3 Database Logs

```bash
# Check for slow queries
tail -f /var/log/postgresql/postgresql.log | grep "duration"

# Monitor active connections
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

---

### Step 6: Verify Functionality

#### 6.1 Super Admin Login

1. Navigate to `https://your-production-web.com/login`
2. Login with Super Admin credentials:
   - Email: `superadmin@raho.id`
   - Password: `Sup3r4dM1n`
3. ✅ Verify successful login
4. ✅ Verify redirect to Super Admin dashboard

#### 6.2 Test Impersonation Flow

**Test 1: Super Admin → Admin Manager**

1. Navigate to `/admin/super-admin`
2. Click "Admin Managers" tab
3. ✅ Verify list of Admin Managers loads
4. Click "Masuk Sebagai" on any manager
5. ✅ Verify impersonation banner appears
6. ✅ Verify redirect to `/admin-manager`
7. ✅ Verify sidebar shows Admin Manager menus
8. ✅ Verify data is filtered by manager's branches
9. Click "Kembali ke Super Admin"
10. ✅ Verify return to Super Admin dashboard

**Test 2: Admin Manager → Admin Cabang**

1. While impersonating Admin Manager, navigate to `/admin-manager`
2. Click "Admin Cabang" tab
3. ✅ Verify list of Branch Admins loads (only from manager's branches)
4. Click "Masuk Sebagai" on any branch admin
5. ✅ Verify nested impersonation banner appears
6. ✅ Verify redirect to `/dashboard`
7. ✅ Verify sidebar shows Admin Cabang menus
8. ✅ Verify data is filtered by single branch
9. Click "Kembali ke Admin Manager"
10. ✅ Verify return to Admin Manager level
11. Click "Kembali ke Super Admin"
12. ✅ Verify return to Super Admin dashboard

**Test 3: Audit Logging**

1. Navigate to `/admin/audit-logs`
2. ✅ Verify impersonation start events are logged
3. ✅ Verify impersonation stop events are logged
4. ✅ Verify all actions during impersonation show original user ID
5. ✅ Verify impersonation metadata is present

#### 6.3 Security Verification

**Test unauthorized access:**

1. Try to access `/admin/managers` as Admin Manager
   - ✅ Expected: 403 Forbidden
2. Try to impersonate Super Admin as Admin Manager
   - ✅ Expected: 403 Forbidden
3. Try to impersonate Admin Cabang from unassigned branch
   - ✅ Expected: 403 Forbidden
4. Try to impersonate inactive user
   - ✅ Expected: 400 Bad Request

---

## Post-Deployment Tasks

### 1. Change Super Admin Password

```bash
# Login as Super Admin
# Navigate to Profile/Settings
# Change password from default to secure password
# Use password manager to store securely
```

### 2. Update Documentation

- [ ] Update `README.md` with new feature
- [ ] Update user training materials
- [ ] Notify team about new feature
- [ ] Schedule training session for Super Admin users

### 3. Monitor for 24 Hours

- [ ] Check error logs every 2 hours
- [ ] Monitor API response times
- [ ] Watch for authentication issues
- [ ] Track impersonation usage metrics

### 4. Create Backup

```bash
# Backup production database
pg_dump -U postgres raho_production > backup_pre_impersonation_$(date +%Y%m%d).sql

# Store backup securely
aws s3 cp backup_pre_impersonation_*.sql s3://your-backup-bucket/
```

---

## Rollback Plan

If critical issues are discovered after deployment:

### Option 1: Quick Rollback (No Database Changes)

```bash
# Revert backend to previous version
cd /path/to/raho-api
git checkout <previous-commit-hash>
npm install
npm run build
pm2 restart raho-api

# Revert frontend to previous version
cd /path/to/raho-web
git checkout <previous-commit-hash>
npm install
npm run build
pm2 restart raho-web
```

### Option 2: Disable Feature (Keep Code)

```bash
# Add feature flag to disable impersonation
# In apps/api/src/config/env.ts
export const ENABLE_IMPERSONATION = process.env.ENABLE_IMPERSONATION === 'true';

# Set environment variable
export ENABLE_IMPERSONATION=false

# Restart services
pm2 restart raho-api raho-web
```

### Option 3: Remove Super Admin User

```bash
# Only if absolutely necessary
psql -U postgres raho_production

DELETE FROM "User" WHERE email = 'superadmin@raho.id';
```

---

## Troubleshooting

### Issue 1: Super Admin Cannot Login

**Symptoms:** 401 Unauthorized when logging in

**Solution:**
```bash
# Verify Super Admin exists
psql -U postgres raho_production -c "SELECT * FROM \"User\" WHERE email = 'superadmin@raho.id';"

# If not found, run essential seed
npm run seed:essential

# Verify password hash
# Password should be bcrypt hash of "Sup3r4dM1n"
```

### Issue 2: Impersonation Token Invalid

**Symptoms:** 401 errors when using impersonation token

**Solution:**
```bash
# Check JWT_SECRET is set correctly
echo $JWT_SECRET

# Verify token expiration settings
# Check apps/api/src/lib/jwt.ts
# Impersonation tokens expire in 8 hours

# Clear browser localStorage and retry
```

### Issue 3: Impersonation Banner Not Showing

**Symptoms:** Banner doesn't appear when impersonating

**Solution:**
```bash
# Check ImpersonationContext is loaded
# Verify apps/web/src/app/(staff)/layout.tsx includes ImpersonationProvider

# Check browser console for errors
# Verify token is stored in localStorage

# Clear cache and hard reload (Ctrl+Shift+R)
```

### Issue 4: Data Access Issues

**Symptoms:** Impersonated user sees wrong data

**Solution:**
```bash
# Verify authentication middleware is extracting deepest user
# Check apps/api/src/middleware/authenticate.ts

# Verify all queries use req.user (not req.originalUser)
# Check service files for correct user context

# Review audit logs to confirm impersonation chain
```

---

## Success Criteria

Deployment is considered successful when:

- ✅ Super Admin can login with default credentials
- ✅ Super Admin can view list of Admin Managers
- ✅ Super Admin can impersonate Admin Manager
- ✅ Admin Manager can impersonate Admin Cabang
- ✅ Nested impersonation works (Super Admin → Admin Manager → Admin Cabang)
- ✅ Impersonation banner displays correctly
- ✅ Stop impersonation returns to previous level
- ✅ All actions are logged to audit log
- ✅ No errors in production logs
- ✅ API response times are normal
- ✅ Security restrictions are enforced

---

## Support Contacts

**Technical Issues:**
- Backend Lead: [Name] - [Email]
- Frontend Lead: [Name] - [Email]
- DevOps Lead: [Name] - [Email]

**Emergency Rollback:**
- On-Call Engineer: [Phone]
- Escalation: [Manager Phone]

---

## Deployment Checklist

Print this checklist and check off each item during deployment:

```
PRE-DEPLOYMENT
[ ] All tests passing
[ ] Security review completed
[ ] Staging tested successfully
[ ] Backup created
[ ] Rollback plan reviewed

DEPLOYMENT
[ ] Database migrations checked (none required)
[ ] Essential seed run (if needed)
[ ] Backend deployed successfully
[ ] Frontend deployed successfully
[ ] Services restarted

VERIFICATION
[ ] Super Admin login works
[ ] Impersonation flow tested
[ ] Audit logs verified
[ ] Security checks passed
[ ] No errors in logs

POST-DEPLOYMENT
[ ] Super Admin password changed
[ ] Documentation updated
[ ] Team notified
[ ] 24-hour monitoring scheduled
[ ] Backup verified

SIGN-OFF
Deployed by: ________________
Date/Time: ________________
Verified by: ________________
```

---

**Deployment Status:** Ready for Production  
**Last Updated:** May 15, 2026  
**Document Version:** 1.0.0
