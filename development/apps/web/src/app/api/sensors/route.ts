import { NextRequest, NextResponse } from 'next/server'

// This route proxies requests to the backend API server
export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const response = await fetch(`${apiUrl}/api/sensors`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching sensors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sensors' },
      { status: 500 }
    )
  }
}
