import { db } from '../server/db';
import { proxies, accounts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function checkProxyStatus() {
  console.log('=== プロキシ設定状況の確認 ===\n');

  // 全プロキシを取得
  const allProxies = await db.select().from(proxies);
  console.log(`総プロキシ数: ${allProxies.length}`);
  console.log(`割り当て済み: ${allProxies.filter(p => p.assignedAccountId).length}`);
  console.log(`DuoPlus登録済み: ${allProxies.filter(p => p.duoplusProxyId).length}`);
  console.log(`ステータス - available: ${allProxies.filter(p => p.status === 'available').length}`);
  console.log(`ステータス - assigned: ${allProxies.filter(p => p.status === 'assigned').length}`);
  console.log(`ステータス - error: ${allProxies.filter(p => p.status === 'error').length}\n`);

  // 割り当て済みプロキシの詳細
  console.log('=== 割り当て済みプロキシの詳細 ===\n');
  const assignedProxies = allProxies.filter(p => p.assignedAccountId);
  
  for (const proxy of assignedProxies) {
    const account = await db.select().from(accounts).where(eq(accounts.id, proxy.assignedAccountId!)).limit(1);
    console.log(`プロキシID: ${proxy.id}`);
    console.log(`  Host: ${proxy.host}:${proxy.port}`);
    console.log(`  Username: ${proxy.username}`);
    console.log(`  DuoPlus Proxy ID: ${proxy.duoplusProxyId || '未登録'}`);
    console.log(`  割り当てアカウント: ${account[0]?.username || 'なし'} (ID: ${proxy.assignedAccountId})`);
    console.log(`  デバイスID: ${account[0]?.deviceId || '未設定'}`);
    console.log(`  ステータス: ${proxy.status}`);
    console.log('');
  }

  // エラーステータスのプロキシ
  const errorProxies = allProxies.filter(p => p.status === 'error');
  if (errorProxies.length > 0) {
    console.log('=== エラーステータスのプロキシ ===\n');
    errorProxies.forEach(proxy => {
      console.log(`プロキシID: ${proxy.id} - ${proxy.host}:${proxy.port}`);
    });
  }

  process.exit(0);
}

checkProxyStatus().catch(console.error);
