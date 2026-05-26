# ✅ Production Deployment Checklist — Super Admin Impersonation

**Feature:** Multi-Level Impersonation System  
**Target:** Production Environment  
**Date:** _______________  
**Deployed By:** _______________

---

## Pre-Deployment (Complete Before Starting)

- [ ] All backend unit tests passing
- [ ] All frontend unit tests passing
- [ ] Integration tests passing
- [ ] API documentation reviewed (`docs/API-IMPERSONATION.md`)
- [ ] Security review completed
- [ ] Staging environment tested successfully
- [ ] Production backup created
- [ ] Rollback plan prepared and reviewed
- [ ] Team notified of deployment window
- [ ] Maintenance window scheduled (if needed)

---

## Deployment Steps

### 1. Database Migrations
- [ ] SSH into production server
- [ ] Navigate to API directory
- [ ] Run `npx prisma migrate status`
- [ ] **Result:** ✅ No migrations required (schema unchanged)

### 2. Essential Seed
- [ ] Check if Super Admin already exists
  ```sql
  SELECT * FROM "User" WHERE email = 'superadmin@raho.id';
  ```
- [ ] If not exists, run: `npm run seed:essential`
- [ ] Verify Super Admin created successfully
- [ ] **Credentials:** superadmin@raho.id / Sup3r4dM1n

### 3. Backend Deployment
- [ ] Build backend: `npm run build`
- [ ] Run tests: `npm test`
- [ ] Deploy to production server
- [ ] Restart API service: `pm2 restart raho-api`
- [ ] Verify API health: `curl https://api.domain.com/health`
- [ ] Check logs for errors: `pm2 logs raho-api`

### 4. Frontend Deployment
- [ ] Build frontend: `npm run build`
- [ ] Deploy to production hosting
- [ ] Restart web service: `pm2 restart raho-web`
- [ ] Verify homepage loads: `curl https://domain.com`
- [ ] Check logs for errors: `pm2 logs raho-web`

### 5. Monitoring
- [ ] Tail API logs: `pm2 logs raho-api --lines 100`
- [ ] Tail web logs: `pm2 logs raho-web --lines 100`
- [ ] Monitor database connections
- [ ] Watch for authentication errors
- [ ] Check error tracking dashboard (Sentry/etc.)

---

## Functional Verification

### Test 1: Super Admin Login
- [ ] Navigate to production login page
- [ ] Login with: superadmin@raho.id / Sup3r4dM1n
- [ ] ✅ Login successful
- [ ] ✅ Redirected to Super Admin dashboard
- [ ] ✅ "Admin Managers" tab visible

### Test 2: Super Admin → Admin Manager Impersonation
- [ ] Click "Admin Managers" tab
- [ ] ✅ List of managers loads
- [ ] Click "Masuk Sebagai" on a manager
- [ ] ✅ Impersonation banner appears
- [ ] ✅ Redirected to `/admin-manager`
- [ ] ✅ Sidebar shows Admin Manager menus
- [ ] ✅ Data filtered by manager's branches
- [ ] Click "Kembali ke Super Admin"
- [ ] ✅ Returned to Super Admin dashboard

### Test 3: Admin Manager → Admin Cabang Impersonation
- [ ] Impersonate an Admin Manager
- [ ] Click "Admin Cabang" tab
- [ ] ✅ List of branch admins loads (filtered by branches)
- [ ] Click "Masuk Sebagai" on a branch admin
- [ ] ✅ Nested impersonation banner shows chain
- [ ] ✅ Redirected to `/dashboard`
- [ ] ✅ Sidebar shows Admin Cabang menus
- [ ] ✅ Data filtered by single branch
- [ ] Click "Kembali" twice
- [ ] ✅ Returned to Super Admin dashboard

### Test 4: Audit Logging
- [ ] Navigate to `/admin/audit-logs`
- [ ] ✅ Impersonation start events logged
- [ ] ✅ Impersonation stop events logged
- [ ] ✅ Actions show original user ID
- [ ] ✅ Impersonation metadata present

### Test 5: Security Checks
- [ ] Try accessing `/admin/managers` as Admin Manager
  - [ ] ✅ 403 Forbidden
- [ ] Try impersonating Super Admin as Admin Manager
  - [ ] ✅ 403 Forbidden
- [ ] Try impersonating Admin Cabang from unassigned branch
  - [ ] ✅ 403 Forbidden
- [ ] Try impersonating inactive user
  - [ ] ✅ 400 Bad Request

---

## Post-Deployment Tasks

### Immediate (Within 1 Hour)
- [ ] Change Super Admin password from default
- [ ] Store new password in password manager
- [ ] Verify no errors in logs (first 30 minutes)
- [ ] Test impersonation flow one more time
- [ ] Notify team deployment is complete

### Within 24 Hours
- [ ] Monitor logs every 2 hours
- [ ] Check API response times
- [ ] Review error tracking dashboard
- [ ] Track impersonation usage metrics
- [ ] Verify audit log entries are correct

### Within 1 Week
- [ ] Update README.md with new feature
- [ ] Update user training materials
- [ ] Schedule training session for Super Admin users
- [ ] Create user guide documentation
- [ ] Gather feedback from initial users

---

## Rollback Triggers

Initiate rollback if any of these occur:

- [ ] Critical authentication errors
- [ ] Data access violations (wrong data shown)
- [ ] Impersonation token errors affecting multiple users
- [ ] Database performance degradation
- [ ] Security vulnerability discovered
- [ ] More than 5% error rate in logs

---

## Rollback Procedure

If rollback is needed:

1. [ ] Notify team immediately
2. [ ] Revert backend to previous version
   ```bash
   git checkout <previous-commit>
   npm install && npm run build
   pm2 restart raho-api
   ```
3. [ ] Revert frontend to previous version
   ```bash
   git checkout <previous-commit>
   npm install && npm run build
   pm2 restart raho-web
   ```
4. [ ] Verify services are running
5. [ ] Test basic functionality
6. [ ] Document rollback reason
7. [ ] Schedule post-mortem meeting

---

## Sign-Off

### Deployment Team

**Deployed By:**  
Name: _______________  
Signature: _______________  
Date/Time: _______________

**Verified By:**  
Name: _______________  
Signature: _______________  
Date/Time: _______________

**Approved By:**  
Name: _______________  
Signature: _______________  
Date/Time: _______________

### Deployment Status

- [ ] ✅ Deployment Successful
- [ ] ⚠️ Deployment Successful with Minor Issues (document below)
- [ ] ❌ Deployment Failed - Rolled Back

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Emergency Contacts

**On-Call Engineer:** _______________  
**Backend Lead:** _______________  
**Frontend Lead:** _______________  
**DevOps Lead:** _______________  
**Manager/Escalation:** _______________

---

**Document Version:** 1.0.0  
**Last Updated:** May 15, 2026
