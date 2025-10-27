'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export function DevicesHeader() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [deviceName, setDeviceName] = useState('')
  const [deviceId, setDeviceId] = useState('')

  const handleAddDevice = () => {
    if (!deviceName || !deviceId) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    // TODO: Implement actual device creation
    toast({
      title: "Device Added",
      description: `Device "${deviceName}" has been added successfully!`,
    })
    
    setDeviceName('')
    setDeviceId('')
    setOpen(false)
  }

  return (
    <div className="flex items-center justify-between space-y-2">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Devices</h2>
        <p className="text-muted-foreground">Monitor your IoT devices and their status</p>
      </div>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Device
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
            <DialogDescription>
              Register a new IoT device to your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device-name">Device Name</Label>
              <Input
                id="device-name"
                placeholder="e.g., Office Sensor 1"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-id">Device ID</Label>
              <Input
                id="device-id"
                placeholder="e.g., DEV-001"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDevice}>
              Add Device
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}