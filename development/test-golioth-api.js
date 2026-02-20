const axios = require('axios')

// Test Golioth API Connection
async function testGoliothAPI() {
  const API_KEY = process.env.GOLIOTH_API_KEY || 'YOUR_API_KEY'
  const PROJECT_ID = process.env.GOLIOTH_PROJECT_ID || 'nn-cellular-alerts'

  console.log('Testing Golioth API...')
  console.log('Project ID:', PROJECT_ID)
  console.log(
    'API Key:',
    API_KEY ? `${API_KEY.substring(0, 10)}...` : 'MISSING'
  )

  if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
    console.error('ERROR: GOLIOTH_API_KEY environment variable not set')
    process.exit(1)
  }

  try {
    const response = await axios.get(
      `https://api.golioth.io/v1/projects/${PROJECT_ID}/devices`,
      {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log('\n✅ SUCCESS!')
    console.log('Status:', response.status)
    console.log('Devices found:', response.data.list?.length || 0)
    console.log('Total devices:', response.data.total)
    console.log('\nFirst 3 devices:')
    response.data.list?.slice(0, 3).forEach((d) => {
      console.log(`  - ${d.name} (${d.id}) - ${d.status}`)
    })
  } catch (error) {
    console.error('\n❌ ERROR!')
    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Status Text:', error.response.statusText)
      console.error('Data:', error.response.data)
      console.error('\nHeaders:', error.response.headers)
    } else if (error.request) {
      console.error('No response received')
      console.error('Request:', error.request)
    } else {
      console.error('Error:', error.message)
    }
  }
}

testGoliothAPI()
