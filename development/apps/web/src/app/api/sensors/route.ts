import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

// Required for static export
export const dynamic = 'force-static'
export const revalidate = false

// This route gets sensors from Supabase
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: sensors, error } = await supabase
      .from('sensors')
      .select('*')
      .order('name')

    if (error) {
      throw error
    }

    return NextResponse.json(sensors)
  } catch (error) {
    console.error('Error fetching sensors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sensors' },
      { status: 500 }
    )
  }
}
