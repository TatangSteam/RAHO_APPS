# Audit Log Quick Reference Guide

## 🔍 How to Query Audit Logs

### Via Database (PostgreSQL)

#### Recent Failed Logins (Security Alert)
```sql
SELECT 
  meta->>'email' as email,
  meta->>'reason' as reason,
  "ipAddress",
  "userAgent",
  "createdAt"
FROM audit_logs
WHERE action = 'FAILED_LOGIN'
ORDER BY "createdAt" DESC
LIMIT 20;
```

#### Brute Force Detection
```sql
SELECT 
  "ipAddress",
  meta->>'email' as targeted_email,
  COUNT(*) as attempts,
  MAX("createdAt") as last_attempt
FROM audit_logs
WHERE action = 'FAILED_LOGIN' 
  AND "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY "ipAddress", meta->>'email'
HAVING COUNT(*) > 5
ORDER BY attempts DESC;
```

#### User Activity Timeline
```sql
SELECT 
  action,
  resource,
  "resourceId",
  meta,
  "createdAt"
FROM audit_logs
WHERE "userId" = 'user-id-here'
ORDER BY "createdAt" DESC
LIMIT 50;
```

#### Password Changes (Last 30 Days)
```sql
SELECT 
  u.email,
  u.role,
  al.action,
  al.meta,
  al."createdAt"
FROM audit_logs al
JOIN users u ON al."userId" = u.id
WHERE al.action IN ('PASSWORD_CHANGE', 'PASSWORD_RESET')
  AND al."createdAt" > NOW() - INTERVAL '30 days'
ORDER BY al."createdAt" DESC;
```

#### Branch Activity
```sql
SELECT 
  action,
  resource,
  "resourceId",
  u.email as performed_by,
  al."createdAt"
FROM audit_logs al
JOIN users u ON al."userId" = u.id
WHERE al."branchId" = 'branch-id-here'
ORDER BY al."createdAt" DESC
LIMIT 50;
```

#### Recent Authentication Events
```sql
SELECT 
  action,
  meta->>'email' as email,
  meta->>'role' as role,
  "ipAddress",
  SUBSTRING("userAgent", 1, 50) as browser,
  "createdAt"
FROM audit_logs
WHERE action IN ('LOGIN', 'LOGOUT', 'FAILED_LOGIN')
ORDER BY "createdAt" DESC
LIMIT 30;
```

#### All Actions by Action Type
```sql
SELECT action, COUNT(*) as count
FROM audit_logs
GROUP BY action
ORDER BY count DESC;
```

#### Today's Activity Summary
```sql
SELECT 
  action,
  COUNT(*) as count
FROM audit_logs
WHERE "createdAt" >= CURRENT_DATE
GROUP BY action
ORDER BY count DESC;
```

### Via Frontend (UI)

Navigate to: **Admin** → **Audit Logs** (`/admin/audit-logs`)

**Filters Available**:
- User (dropdown)
- Action Type (LOGIN, CREATE, UPDATE, etc.)
- Resource Type (User, Member, Package, etc.)
- Date Range
- Branch (for Super Admin)

## 🚨 Security Alerts to Monitor

### Critical: Multiple Failed Logins
**Query**: See "Brute Force Detection" above
**Threshold**: > 5 attempts in 1 hour from same IP
**Action**: 
- Block IP if external
- Investigate if internal
- Contact user to verify account security

### Critical: Unauthorized Password Resets
**Query**:
```sql
SELECT 
  al."resourceId" as target_user,
  al.meta->>'resetByEmail' as reset_by,
  al."createdAt",
  u.email as target_email
FROM audit_logs al
JOIN users u ON al."resourceId" = u.id
WHERE al.action = 'PASSWORD_RESET'
  AND al."createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY al."createdAt" DESC;
```
**Action**: Verify dengan admin yang mereset

### High: Email Changes
**Query**:
```sql
SELECT 
  "resourceId" as user_id,
  meta->>'oldEmail' as old_email,
  meta->>'newEmail' as new_email,
  meta->>'changedByEmail' as changed_by,
  "createdAt"
FROM audit_logs
WHERE action = 'UPDATE' AND meta->>'action' = 'email_change'
ORDER BY "createdAt" DESC;
```
**Action**: Verify legitimacy

### Medium: After-Hours Activity
**Query**:
```sql
SELECT 
  action,
  resource,
  u.email as user,
  al."createdAt"
FROM audit_logs al
JOIN users u ON al."userId" = u.id
WHERE EXTRACT(HOUR FROM al."createdAt") NOT BETWEEN 6 AND 22
  AND al."createdAt" > NOW() - INTERVAL '7 days'
ORDER BY al."createdAt" DESC;
```
**Action**: Review for suspicious patterns

## 📊 Common Reports

### Daily Authentication Report
```sql
SELECT 
  DATE(al."createdAt") as date,
  al.action,
  COUNT(*) as count
FROM audit_logs al
WHERE al.action IN ('LOGIN', 'LOGOUT', 'FAILED_LOGIN')
  AND al."createdAt" > NOW() - INTERVAL '7 days'
GROUP BY DATE(al."createdAt"), al.action
ORDER BY date DESC, action;
```

### User Management Activity Report
```sql
SELECT 
  DATE(al."createdAt") as date,
  al.action,
  al.resource,
  COUNT(*) as count
FROM audit_logs al
WHERE al.resource = 'User'
  AND al."createdAt" > NOW() - INTERVAL '30 days'
GROUP BY DATE(al."createdAt"), al.action, al.resource
ORDER BY date DESC, count DESC;
```

### Branch Activity Summary
```sql
SELECT 
  b.name as branch,
  al.action,
  COUNT(*) as count
FROM audit_logs al
JOIN branches b ON al."branchId" = b.id
WHERE al."createdAt" > NOW() - INTERVAL '7 days'
GROUP BY b.name, al.action
ORDER BY branch, count DESC;
```

## 🔧 Troubleshooting

### User Reports: "I didn't change my password"
```sql
SELECT 
  action,
  meta,
  "ipAddress",
  "userAgent",
  "createdAt"
FROM audit_logs
WHERE "resourceId" = 'user-id-here'
  AND action IN ('PASSWORD_CHANGE', 'PASSWORD_RESET')
ORDER BY "createdAt" DESC;
```

### User Reports: "I can't login"
```sql
-- Check recent failed attempts
SELECT 
  action,
  meta->>'reason' as reason,
  "ipAddress",
  "createdAt"
FROM audit_logs
WHERE meta->>'email' = 'user-email-here'
  AND action = 'FAILED_LOGIN'
  AND "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;

-- Check if account was deactivated
SELECT 
  action,
  meta,
  u.email as deactivated_by,
  al."createdAt"
FROM audit_logs al
JOIN users u ON al."userId" = u.id
WHERE al."resourceId" = 'user-id-here'
  AND al.action = 'DELETE'
  AND al.meta->>'action' = 'deactivate'
ORDER BY al."createdAt" DESC;
```

### Package Payment Issues
```sql
SELECT 
  action,
  "resourceId" as package_id,
  meta,
  u.email as performed_by,
  al."createdAt"
FROM audit_logs al
JOIN users u ON al."userId" = u.id
WHERE al."resourceId" = 'package-id-here'
  AND al.resource IN ('Package', 'Invoice')
ORDER BY al."createdAt" DESC;
```

## 📈 Performance Queries

### Audit Log Growth Rate
```sql
SELECT 
  DATE(al."createdAt") as date,
  COUNT(*) as logs_created
FROM audit_logs al
WHERE al."createdAt" > NOW() - INTERVAL '30 days'
GROUP BY DATE(al."createdAt")
ORDER BY date DESC;
```

### Disk Space Usage (Approximate)
```sql
SELECT 
  pg_size_pretty(pg_total_relation_size('audit_logs')) as table_size,
  COUNT(*) as total_rows
FROM audit_logs;
```

### Oldest Audit Log
```sql
SELECT MIN("createdAt") as oldest_log FROM audit_logs;
```

## 🛠️ Maintenance Commands

### Archive Old Logs (> 1 year)
```sql
-- Create archive table if not exists
CREATE TABLE IF NOT EXISTS audit_logs_archive (LIKE audit_logs INCLUDING ALL);

-- Move old logs to archive
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE "createdAt" < NOW() - INTERVAL '1 year';

-- Delete from main table
DELETE FROM audit_logs
WHERE "createdAt" < NOW() - INTERVAL '1 year';

-- Verify
SELECT 
  'main' as table, COUNT(*) as count FROM audit_logs
UNION ALL
SELECT 
  'archive' as table, COUNT(*) as count FROM audit_logs_archive;
```

### Vacuum & Analyze (After Large Deletes)
```sql
VACUUM ANALYZE audit_logs;
```

### Check Indexes
```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'audit_logs';
```

## 🎯 Action Types Reference

| Action | Description | Critical? |
|--------|-------------|-----------|
| `LOGIN` | Successful login | Medium |
| `LOGOUT` | User logout | Low |
| `FAILED_LOGIN` | Failed login attempt | **HIGH** |
| `PASSWORD_CHANGE` | User changed own password | Medium |
| `PASSWORD_RESET` | Admin reset user password | **HIGH** |
| `CREATE` | Resource created | Medium |
| `UPDATE` | Resource updated | Low-Medium |
| `DELETE` | Resource deleted/deactivated | **HIGH** |

## 📞 Support Contacts

**Security Issues**: Contact Super Admin immediately
**Data Requests**: Submit via audit log UI export feature
**Technical Issues**: Contact Development Team

---

**Last Updated**: June 2, 2026
**Version**: 1.0
**Maintained By**: Development Team
