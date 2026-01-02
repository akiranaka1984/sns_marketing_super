import axios from 'axios';

const DUOPLUS_API_BASE = 'https://openapi.duoplus.net';

console.log('=== Environment Variable Check ===');
console.log('DUOPLUS_API_KEY from env:', process.env.DUOPLUS_API_KEY);
console.log('Length:', process.env.DUOPLUS_API_KEY?.length || 0);

console.log('\n=== Testing with Environment Key ===');
try {
  const response = await axios.post(
    `${DUOPLUS_API_BASE}/api/v1/cloudPhone/list`,
    { page: 1, page_size: 10 },
    {
      headers: {
        'DuoPlus-API-Key': process.env.DUOPLUS_API_KEY,
        'Content-Type': 'application/json',
      }
    }
  );
  console.log('✅ Success');
  console.log('Response code:', response.data.code);
  console.log('Device count:', response.data.data?.list?.length || 0);
} catch (error) {
  console.log('❌ Failed');
  console.log('Error:', error.message);
  if (error.response) {
    console.log('Response:', error.response.data);
  }
}
