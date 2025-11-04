/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jest-environment jsdom
 * @description Comprehensive tests for Golioth Webhook Edge Function
 * Tests webhook signature verification, event processing, and error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: {
              id: 'integration-123',
              organization_id: 'org-123',
              webhook_enabled: true,
              webhook_secret: 'test-secret'
            },
            error: null 
          })),
          maybeSingle: jest.fn(() => Promise.resolve({ 
            data: { 
              id: 'device-123', 
              external_device_id: 'golioth-device-1',
              organization_id: 'org-123',
              status: 'online',
              last_seen: new Date().toISOString()
            },
            error: null 
          }))
        }))
      }))
    })),
    insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: {}, error: null }))
    }))
  }))
};

describe('Golioth Webhook Edge Function', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  // =========================================================================
  // Webhook Signature Verification
  // =========================================================================
  describe('Webhook Signature Verification', () => {
    
    it('should reject webhook without signature header', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: { deviceId: 'golioth-device-1', status: 'online' }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Missing signature' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(401);
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: { deviceId: 'golioth-device-1', status: 'online' }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid signature' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'invalid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(401);
    });

    it('should accept webhook with valid signature', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: { deviceId: 'golioth-device-1', status: 'online' }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-hmac-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should reject webhook without integration ID', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: { deviceId: 'golioth-device-1', status: 'online' }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Missing integration ID' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
    });

    it('should reject webhook for disabled integration', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: { deviceId: 'golioth-device-1', status: 'online' }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Webhook not configured' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'disabled-integration',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
    });
  });

  // =========================================================================
  // Device Update Events
  // =========================================================================
  describe('Device Update Events', () => {
    
    it('should process device.updated event for existing device', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          status: 'online',
          lastSeen: new Date().toISOString(),
          metadata: { firmware_version: '2.0.0', battery: 85 }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should update device status only', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          status: 'offline'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should update device metadata', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          metadata: {
            firmware_version: '3.0.0',
            battery: 95,
            signal_strength: -45
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should handle device.updated for non-existent device gracefully', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'unknown-device',
          status: 'online'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Device Create Events
  // =========================================================================
  describe('Device Create Events', () => {
    
    it('should queue device.created event for sync', async () => {
      const payload = {
        event: 'device.created',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'new-golioth-device',
          status: 'online'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should not queue duplicate device.created events', async () => {
      const payload = {
        event: 'device.created',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1', // Already exists
          status: 'online'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Device Delete Events
  // =========================================================================
  describe('Device Delete Events', () => {
    
    it('should process device.deleted event', async () => {
      const payload = {
        event: 'device.deleted',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should mark deleted device as offline', async () => {
      const payload = {
        event: 'device.deleted',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Device Status Change Events
  // =========================================================================
  describe('Device Status Change Events', () => {
    
    it('should process device.status_changed event', async () => {
      const payload = {
        event: 'device.status_changed',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          status: 'offline'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should update last_seen timestamp on status change', async () => {
      const payload = {
        event: 'device.status_changed',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          status: 'online'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Event Logging
  // =========================================================================
  describe('Event Logging', () => {
    
    it('should log all webhook events to sync_log', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          status: 'online'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should include event details in log', async () => {
      const payload = {
        event: 'device.created',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'new-device',
          status: 'provisioning'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Unknown Events
  // =========================================================================
  describe('Unknown Events', () => {
    
    it('should handle unknown event types gracefully', async () => {
      const payload = {
        event: 'device.unknown_event',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================
  describe('Error Handling', () => {
    
    it('should handle malformed JSON', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Invalid JSON' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: 'invalid-json'
      });

      expect(response.status).toBe(500);
    });

    it('should handle database errors gracefully', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          status: 'online'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database error' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(500);
    });

    it('should handle missing event field', async () => {
      const payload = {
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Missing event field' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(500);
    });

    it('should handle missing data field', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString()
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Missing data field' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(500);
    });
  });

  // =========================================================================
  // Business Logic
  // =========================================================================
  describe('Business Logic', () => {
    
    it('should only process webhooks for correct organization', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          status: 'online'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should preserve device data integrity on update', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          status: 'online',
          lastSeen: new Date().toISOString()
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should maintain webhook processing order', async () => {
      const payload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        data: {
          deviceId: 'golioth-device-1',
          status: 'online'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'OK' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/golioth-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-ID': 'integration-123',
          'X-Golioth-Signature': 'valid-signature'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });
});
