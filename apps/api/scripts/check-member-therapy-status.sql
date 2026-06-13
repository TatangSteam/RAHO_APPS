-- ============================================================
-- SQL Script: Check Member Package and Therapy Plan Status
-- ============================================================
-- Purpose: Debug why bulk therapy plan modal shows canCreate = 0
-- 
-- Usage:
-- 1. Replace '<MEMBER_ID>' with actual member ID
-- 2. Run this query in your database tool
-- ============================================================

-- Check member's basic info
SELECT 
  m.id as memberId,
  m.memberNo,
  u.email,
  p.fullName,
  m.status as memberStatus
FROM "Member" m
LEFT JOIN "User" u ON u.id = m.userId
LEFT JOIN "Profile" p ON p.userId = m.userId
WHERE m.id = '<MEMBER_ID>';

-- Check member's packages (all status)
SELECT 
  mp.id,
  mp.packageCode,
  mp.packageType,
  mp.totalSessions,
  mp.usedSessions,
  (mp.totalSessions - mp.usedSessions) as sessionsRemaining,
  mp.status,
  mp.createdAt,
  mp.activatedAt,
  mp.expiredAt,
  b.name as branchName
FROM "MemberPackage" mp
LEFT JOIN "Branch" b ON b.id = mp.branchId
WHERE mp.memberId = '<MEMBER_ID>'
ORDER BY mp.createdAt DESC;

-- Count therapy plans for this member
SELECT 
  COUNT(*) as totalTherapyPlans,
  COUNT(CASE WHEN isUsed = true THEN 1 END) as usedTherapyPlans,
  COUNT(CASE WHEN isUsed = false THEN 1 END) as unusedTherapyPlans
FROM "TherapyPlan"
WHERE memberId = '<MEMBER_ID>';

-- Show therapy plans detail
SELECT 
  tp.id,
  tp.planCode,
  tp.keterangan,
  tp.isUsed,
  tp.createdAt,
  CASE 
    WHEN ts.id IS NOT NULL THEN 'Used in Session: ' || ts.sessionCode
    ELSE 'Not Used'
  END as usageStatus
FROM "TherapyPlan" tp
LEFT JOIN "TreatmentSession" ts ON ts.therapyPlanId = tp.id
WHERE tp.memberId = '<MEMBER_ID>'
ORDER BY tp.createdAt;

-- Calculate expected canCreate value
SELECT 
  mp.packageType,
  mp.totalSessions,
  mp.usedSessions,
  (mp.totalSessions - mp.usedSessions) as vouchersRemaining,
  COUNT(tp.id) as existingTherapyPlans,
  (mp.totalSessions - COUNT(tp.id)) as expectedCanCreate,
  CASE 
    WHEN mp.status != 'ACTIVE' THEN 'Package not active'
    WHEN (mp.totalSessions - COUNT(tp.id)) <= 0 THEN 'All therapy plans created'
    ELSE 'Can create ' || (mp.totalSessions - COUNT(tp.id)) || ' plans'
  END as recommendation
FROM "MemberPackage" mp
LEFT JOIN "TherapyPlan" tp ON tp.memberId = mp.memberId
WHERE mp.memberId = '<MEMBER_ID>'
  AND mp.status = 'ACTIVE'
GROUP BY mp.id, mp.packageType, mp.totalSessions, mp.usedSessions, mp.status;

-- ============================================================
-- EXAMPLE RESULTS INTERPRETATION
-- ============================================================
--
-- Scenario 1: canCreate = 0, All plans created
-- totalSessions = 7, existingTherapyPlans = 7
-- expectedCanCreate = 0
-- → Member needs to purchase more sessions or wait for package upgrade
--
-- Scenario 2: canCreate should be > 0
-- totalSessions = 7, existingTherapyPlans = 3
-- expectedCanCreate = 4
-- → Modal should show 4 rows, if showing 0 then there's a bug
--
-- Scenario 3: No active package
-- Result: 0 rows returned
-- → Member needs to purchase a package first
-- ============================================================
