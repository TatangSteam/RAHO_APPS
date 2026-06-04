const { SystemStatsService } = require('./dist/modules/admin/services/system-stats.service');

const service = new SystemStatsService();

async function testSystemStats() {
  try {
    console.log('🧪 Testing System Stats Service...\n');
    
    const stats = await service.getSystemStats();
    
    console.log('📊 System Stats Result:');
    console.log(JSON.stringify(stats, null, 2));
    
    if (stats.totalBranches === 0 && stats.totalUsers === 0) {
      console.log('\n⚠️  All stats are 0 - there might be an error');
    } else {
      console.log('\n✅ Stats loaded successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

testSystemStats();
