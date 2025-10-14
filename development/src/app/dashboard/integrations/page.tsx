'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function IntegrationsPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/dashboard/organizations')
  }, [router])

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrations</h1>
          <p className="text-gray-600">
            Redirecting to Organizations page...
          </p>
        </div>
      </div>
      
      <div className="card">
        <div className="card-content">
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              Integrations are now managed per organization for better security and isolation.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              You will be redirected to the Organizations page where you can manage integrations for each organization.
            </p>
            <a 
              href="/dashboard/organizations" 
              className="btn btn-primary"
            >
              Go to Organizations
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
