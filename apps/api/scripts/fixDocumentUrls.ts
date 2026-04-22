/**
 * Fix existing document URLs from presigned to permanent URLs
 * Run: npx tsx scripts/fixDocumentUrls.ts
 */

import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';

async function fixDocumentUrls() {
  console.log('\n🔧 Fixing document URLs...\n');

  // Get all documents
  const documents = await prisma.memberDocument.findMany();

  console.log(`Found ${documents.length} documents to check\n`);

  let fixed = 0;
  let skipped = 0;

  for (const doc of documents) {
    // Check if URL contains query parameters (presigned URL signature)
    if (doc.fileUrl.includes('?')) {
      // Extract the base URL without query parameters
      const baseUrl = doc.fileUrl.split('?')[0];
      
      console.log(`Fixing: ${doc.fileName}`);
      console.log(`  Old: ${doc.fileUrl.substring(0, 80)}...`);
      console.log(`  New: ${baseUrl}`);

      // Update to permanent URL
      await prisma.memberDocument.update({
        where: { id: doc.id },
        data: { fileUrl: baseUrl },
      });

      fixed++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Fixed ${fixed} documents`);
  console.log(`⏭️  Skipped ${skipped} documents (already using permanent URLs)\n`);
  console.log('🎉 Done!\n');
}

fixDocumentUrls()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
