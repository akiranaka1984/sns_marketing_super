import { db } from '../server/db';

async function checkPost() {
  const post = await db.query.scheduledPosts.findFirst({
    where: (posts, { eq }) => eq(posts.id, 60001),
  });

  console.log('投稿ID 60001の詳細:');
  console.log(JSON.stringify(post, null, 2));

  if (post) {
    // アカウント情報を確認
    const account = await db.query.accounts.findFirst({
      where: (accounts, { eq }) => eq(accounts.id, post.accountId),
    });

    console.log('\nアカウント情報:');
    console.log(JSON.stringify(account, null, 2));

    if (account?.deviceId) {
      // デバイス情報を確認
      const device = await db.query.devices.findFirst({
        where: (devices, { eq }) => eq(devices.deviceId, account.deviceId),
      });

      console.log('\nデバイス情報:');
      console.log(JSON.stringify(device, null, 2));
    }
  }

  process.exit(0);
}

checkPost().catch(console.error);
