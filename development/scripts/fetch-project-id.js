#!/usr/bin/env node

/**
 * Fetch Golioth Project ID from API Key
 *
 * This script will use your Golioth API key to fetch all available projects
 * and display their IDs and names so you can choose the correct one.
 */

const fetchProjectId = async () => {
  console.log('🔍 Fetching Golioth projects...\n')

  // You can pass your API key as a command line argument or set it here
  const apiKey = process.argv[2] || process.env.GOLIOTH_API_KEY

  if (!apiKey) {
    console.log('❌ Error: No API key provided')
    console.log('Usage: node fetch-project-id.js <your-golioth-api-key>')
    console.log('   or: GOLIOTH_API_KEY=<your-key> node fetch-project-id.js')
    process.exit(1)
  }

  try {
    // Make direct API call to Golioth
    const response = await fetch('https://api.golioth.io/v1/projects', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    const projects = result.data || []

    if (projects.length === 0) {
      console.log('📋 No projects found for this API key')
      return
    }

    console.log(`✅ Found ${projects.length} project(s):\n`)

    projects.forEach((project, index) => {
      console.log(`${index + 1}. Project Name: "${project.name}"`)
      console.log(`   Project ID: ${project.id}`)
      console.log(
        `   Created: ${new Date(project.created_at).toLocaleDateString()}`
      )
      console.log(`   Devices: ${project.device_count || 0}`)
      console.log('')
    })

    console.log('🔧 To use a project in your .env.local file:')
    console.log('GOLIOTH_PROJECT_ID=<copy-project-id-from-above>')
    console.log(`GOLIOTH_API_KEY=${apiKey}`)
  } catch (error) {
    console.error('❌ Error fetching projects:', error.message)

    if (
      error.message.includes('401') ||
      error.message.includes('Unauthorized')
    ) {
      console.log(
        '\n💡 Tip: Check that your API key is correct and has the right permissions'
      )
    } else if (error.message.includes('404')) {
      console.log(
        "\n💡 Tip: Make sure you're using the correct Golioth API base URL"
      )
    }
  }
}

fetchProjectId()
