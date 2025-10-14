import { redirect } from 'next/navigation'

export default async function HomePage() {
  // TEMPORARILY: Direct to dashboard for testing without auth
  // TODO: Re-enable authentication checks after setup
  redirect('/dashboard')
}