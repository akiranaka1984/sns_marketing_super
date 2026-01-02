import { db } from './server/db.js';
import { interactions } from './drizzle/schema.js';
import { eq, desc } from 'drizzle-orm';

console.log('=== Failed Interactions Error Messages ===\n');

try {
  const results = await db.select()
    .from(interactions)
    .where(eq(interactions.status, 'failed'))
    .orderBy(desc(interactions.createdAt))
    .limit(5);
  
  if (results.length === 0) {
    console.log('No failed interactions found');
  } else {
    results.forEach((record, index) => {
      console.log(`\n--- Record ${index + 1} ---`);
      console.log('ID:', record.id);
      console.log('Type:', record.interactionType);
      console.log('Status:', record.status);
      console.log('Error Message:', record.errorMessage || '(no error message)');
      console.log('Created At:', record.createdAt);
      console.log('Executed At:', record.executedAt);
    });
  }
} catch (error) {
  console.log('❌ Error:', error.message);
}

process.exit(0);
