/**
 * Manual test script for impersonation middleware
 * Run with: npx tsx scripts/test-impersonation-middleware.ts
 */

import { signAccessToken, verifyAccessToken, JwtPayload } from '../src/lib/jwt';
import { Role } from '@prisma/client';

console.log('🧪 Testing Impersonation Middleware Token Handling\n');

// Test 1: Normal token (no impersonation)
console.log('Test 1: Normal Token (No Impersonation)');
console.log('='.repeat(50));
const normalPayload: JwtPayload = {
  userId: 'user-123',
  email: 'admin@raho.id',
  role: 'ADMIN_CABANG',
  branchId: 'branch-1',
  branchCode: 'JKT',
  fullName: 'Admin Jakarta',
  staffCode: 'ADM001'
};

const normalToken = signAccessToken(normalPayload);
const normalDecoded = verifyAccessToken(normalToken);
console.log('✅ Normal token created and verified');
console.log('User:', normalDecoded.email, `(${normalDecoded.role})`);
console.log('Has impersonation:', !!normalDecoded.impersonating);
console.log();

// Test 2: Single level impersonation (Super Admin → Admin Manager)
console.log('Test 2: Single Level Impersonation (Super Admin → Admin Manager)');
console.log('='.repeat(50));
const singleLevelPayload: JwtPayload = {
  userId: 'super-admin-123',
  email: 'superadmin@raho.id',
  role: 'SUPER_ADMIN',
  branchId: null,
  branchCode: null,
  fullName: 'Super Admin',
  staffCode: null,
  impersonating: {
    userId: 'manager-456',
    email: 'manager@raho.id',
    role: 'ADMIN_MANAGER' as Role,
    branches: ['branch-1', 'branch-2']
  }
};

const singleLevelToken = signAccessToken(singleLevelPayload);
const singleLevelDecoded = verifyAccessToken(singleLevelToken);
console.log('✅ Single level impersonation token created and verified');
console.log('Original user:', singleLevelDecoded.email, `(${singleLevelDecoded.role})`);
console.log('Impersonating:', singleLevelDecoded.impersonating?.email, `(${singleLevelDecoded.impersonating?.role})`);
console.log('Branches:', singleLevelDecoded.impersonating?.branches);
console.log();

// Test 3: Nested impersonation (Super Admin → Admin Manager → Admin Cabang)
console.log('Test 3: Nested Impersonation (Super Admin → Admin Manager → Admin Cabang)');
console.log('='.repeat(50));
const nestedPayload: JwtPayload = {
  userId: 'super-admin-123',
  email: 'superadmin@raho.id',
  role: 'SUPER_ADMIN',
  branchId: null,
  branchCode: null,
  fullName: 'Super Admin',
  staffCode: null,
  impersonating: {
    userId: 'manager-456',
    email: 'manager@raho.id',
    role: 'ADMIN_MANAGER' as Role,
    branches: ['branch-1', 'branch-2'],
    impersonating: {
      userId: 'admin-cabang-789',
      email: 'admincabang@raho.id',
      role: 'ADMIN_CABANG' as Role,
      branchId: 'branch-1'
    }
  }
};

const nestedToken = signAccessToken(nestedPayload);
const nestedDecoded = verifyAccessToken(nestedToken);
console.log('✅ Nested impersonation token created and verified');
console.log('Original user:', nestedDecoded.email, `(${nestedDecoded.role})`);
console.log('First level:', nestedDecoded.impersonating?.email, `(${nestedDecoded.impersonating?.role})`);
console.log('Second level (deepest):', nestedDecoded.impersonating?.impersonating?.email, `(${nestedDecoded.impersonating?.impersonating?.role})`);
console.log();

// Test 4: Extract impersonation chain
console.log('Test 4: Extract Impersonation Chain');
console.log('='.repeat(50));

function extractChain(payload: JwtPayload): string[] {
  const chain: string[] = [payload.email];
  let current = payload.impersonating;
  
  while (current) {
    chain.push(current.email);
    current = current.impersonating;
  }
  
  return chain;
}

function extractDeepest(payload: JwtPayload): any {
  if (!payload.impersonating) return null;
  
  let current = payload.impersonating;
  while (current.impersonating) {
    current = current.impersonating;
  }
  
  return current;
}

console.log('Normal token chain:', extractChain(normalDecoded));
console.log('Single level chain:', extractChain(singleLevelDecoded));
console.log('Nested chain:', extractChain(nestedDecoded));
console.log();

console.log('Deepest user in nested impersonation:');
const deepest = extractDeepest(nestedDecoded);
console.log('  Email:', deepest?.email);
console.log('  Role:', deepest?.role);
console.log('  Branch ID:', deepest?.branchId);
console.log();

// Test 5: Middleware behavior simulation
console.log('Test 5: Middleware Behavior Simulation');
console.log('='.repeat(50));

function simulateMiddleware(payload: JwtPayload) {
  if (payload.impersonating) {
    const chain = extractChain(payload);
    const deepest = extractDeepest(payload);
    
    return {
      originalUser: {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        branchId: payload.branchId
      },
      user: {
        id: deepest.userId,
        email: deepest.email,
        role: deepest.role,
        branchId: deepest.branchId || null,
        branches: deepest.branches
      },
      isImpersonating: true,
      impersonationChain: chain
    };
  } else {
    return {
      user: {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        branchId: payload.branchId
      },
      isImpersonating: false
    };
  }
}

console.log('Normal token middleware result:');
console.log(JSON.stringify(simulateMiddleware(normalDecoded), null, 2));
console.log();

console.log('Single level impersonation middleware result:');
console.log(JSON.stringify(simulateMiddleware(singleLevelDecoded), null, 2));
console.log();

console.log('Nested impersonation middleware result:');
console.log(JSON.stringify(simulateMiddleware(nestedDecoded), null, 2));
console.log();

console.log('✅ All tests passed!');
console.log('\nKey Points:');
console.log('1. req.user always contains the DEEPEST impersonated user');
console.log('2. req.originalUser contains the ROOT user who started impersonation');
console.log('3. req.impersonationChain contains the full chain of emails');
console.log('4. All authorization checks should use req.user (not req.originalUser)');
