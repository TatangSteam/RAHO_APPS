'use client';

import { useEffect } from 'react';

export default function TestMembersPage() {
  useEffect(() => {
    console.log('[TestMembersPage] Component mounted!');
  }, []);

  console.log('[TestMembersPage] Rendering...');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-green-600">✓ Test Members Page Works!</h1>
      <p className="mt-4">Jika Anda melihat halaman ini, berarti routing Next.js bekerja.</p>
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <p className="font-semibold">Masalahnya ada di route group (staff)</p>
        <p className="mt-2 text-sm text-gray-600">
          File: apps/web/src/app/test-members/page.tsx
        </p>
      </div>
    </div>
  );
}
