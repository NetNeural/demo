'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface User {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'org_admin' | 'org_owner' | 'user' | 'viewer'
  status: 'active' | 'inactive' | 'pending'
  lastLogin: string
  department: string
}

export function UsersList() {
  const [users] = useState<User[]>([
    {
      id: '1',
      name: 'NetNeural Admin',
      email: 'admin@netneural.ai',
      role: 'super_admin',
      status: 'active',
      lastLogin: '5 minutes ago',
      department: 'IT Administration'
    },
    {
      id: '2',
      name: 'John Doe',
      email: 'john.doe@netneural.ai',
      role: 'org_admin',
      status: 'active',
      lastLogin: '2 hours ago',
      department: 'Operations'
    },
    {
      id: '3',
      name: 'Jane Smith',
      email: 'jane.smith@netneural.ai',
      role: 'user',
      status: 'active',
      lastLogin: '1 day ago',
      department: 'Quality Control'
    },
    {
      id: '4',
      name: 'Mike Johnson',
      email: 'mike.johnson@netneural.ai',
      role: 'user',
      status: 'inactive',
      lastLogin: '1 week ago',
      department: 'Maintenance'
    }
  ])

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'super_admin': return '👑'
      case 'org_admin': return '🔑'
      case 'org_owner': return '🏢'
      case 'user': return '👤'
      case 'viewer': return '👁️'
      default: return '❓'
    }
  }

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'inactive': return 'text-gray-600 bg-gray-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-400 bg-gray-50'
    }
  }

  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'super_admin': return 'text-purple-600 bg-purple-100'
      case 'org_admin': return 'text-blue-600 bg-blue-100'
      case 'org_owner': return 'text-indigo-600 bg-indigo-100'
      case 'user': return 'text-green-600 bg-green-100'
      case 'viewer': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-400 bg-gray-50'
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Organization Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-lg">{getRoleIcon(user.role)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">{user.department}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="flex space-x-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded ${getRoleColor(user.role)}`}>
                        {user.role.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(user.status)}`}>
                        {user.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last login: {user.lastLogin}
                    </p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No users found</p>
              <Button className="mt-4">Invite Your First User</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}