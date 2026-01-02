import axios from 'axios';

const CORRECT_KEY = '9b2f2c48-1e2b-4caa-a329-aec8e6bb7deb';
const DUOPLUS_API_BASE = 'https://openapi.duoplus.net';

console.log('=== Testing with Correct API Key ===');
console.log('API Key:', CORRECT_KEY);

try {
  const response = await axios.post(
    `${DUOPLUS_API_BASE}/api/v1/cloudPhone/list`,
    { page: 1, page_size: 10 },
    {
      headers: {
        'DuoPlus-API-Key': CORRECT_KEY,
        'Content-Type': 'application/json',
      }
    }
  );
  console.log('✅ Success!');
  console.log('Response code:', response.data.code);
  console.log('Device count:', response.data.data?.list?.length || 0);
  console.log('\nFirst device:', response.data.data?.list?.[0]?.image_id);
} catch (error) {
  console.log('❌ Failed');
  console.log('Error:', error.message);
  if (error.response) {
    console.log('Response:', error.response.data);
  }
}
