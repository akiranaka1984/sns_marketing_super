import axios from 'axios';

const DUOPLUS_API_KEY = process.env.DUOPLUS_API_KEY || '';
const DUOPLUS_API_URL = 'https://openapi.duoplus.net';

async function testCloudDrive() {
  try {
    console.log('Testing Cloud Drive API...');
    console.log('API Key:', DUOPLUS_API_KEY ? `${DUOPLUS_API_KEY.substring(0, 10)}...` : 'NOT SET');
    
    const response = await axios.post(
      `${DUOPLUS_API_URL}/api/v1/cloudDisk/list`,
      {
        keyword: '',
        page: 1,
        pagesize: 100,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'DuoPlus-API-Key': DUOPLUS_API_KEY,
        },
        timeout: 30000,
      }
    );
    
    console.log('\n=== Response ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data?.data?.list) {
      console.log('\n=== Files Found ===');
      response.data.data.list.forEach((file, index) => {
        console.log(`${index + 1}. Name: ${file.name}`);
        console.log(`   Original: ${file.original_file_name}`);
        console.log(`   ID: ${file.id}`);
        console.log(`   Type: ${file.file_type}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCloudDrive();
