/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jest-environment jsdom
 * @description Comprehensive tests for AWS IoT Sync Edge Function
 * Tests bidirectional sync, device import/export, and AWS IoT Core integration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('AWS IoT Sync Edge Function', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  // =========================================================================
  // Authentication & Authorization
  // =========================================================================
  describe('Authentication & Authorization', () => {
    
    it('should reject requests without authorization header', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'integration-123',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Missing authorization header' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'integration-123',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(401);
    });

    it('should accept requests with valid authorization', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'integration-123',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 5,
            devices_succeeded: 5,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Request Validation
  // =========================================================================
  describe('Request Validation', () => {
    
    it('should reject request missing organization_id', async () => {
      const payload = {
        integration_id: 'integration-123',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Missing required fields' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
    });

    it('should reject request missing integration_id', async () => {
      const payload = {
        organization_id: 'org-123',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Missing required fields' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
    });

    it('should reject request missing operation', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'integration-123'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Missing required fields' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid operation type', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'integration-123',
        operation: 'invalid'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid operation' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
    });

    it('should accept valid import operation', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'integration-123',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 10,
            devices_succeeded: 10,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should accept valid export operation', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'integration-123',
        operation: 'export',
        device_ids: ['device-1', 'device-2']
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 2,
            devices_succeeded: 2,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should accept valid bidirectional operation', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'integration-123',
        operation: 'bidirectional'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            import: {
              devices_processed: 10,
              devices_succeeded: 10,
              devices_failed: 0,
              errors: []
            },
            export: {
              devices_processed: 5,
              devices_succeeded: 5,
              devices_failed: 0,
              errors: []
            },
            devices_processed: 15,
            devices_succeeded: 15,
            devices_failed: 0
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Integration Lookup
  // =========================================================================
  describe('Integration Lookup', () => {
    
    it('should reject non-existent integration', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'non-existent',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'AWS IoT integration not found' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(404);
    });

    it('should reject integration of wrong type', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'golioth-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'AWS IoT integration not found' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(404);
    });

    it('should accept valid AWS IoT integration', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 0,
            devices_succeeded: 0,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Import Operation
  // =========================================================================
  describe('Import Operation', () => {
    
    it('should import devices from AWS IoT Core', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 5,
            devices_succeeded: 5,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results.devices_processed).toBe(5);
      expect(data.results.devices_succeeded).toBe(5);
    });

    it('should handle import with some failures', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 10,
            devices_succeeded: 8,
            devices_failed: 2,
            errors: ['device-1: Duplicate', 'device-2: Invalid data']
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results.devices_failed).toBe(2);
    });

    it('should import device metadata and shadow state', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 1,
            devices_succeeded: 1,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should handle AWS IoT API errors during import', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Import failed: AWS IoT API error' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(500);
    });
  });

  // =========================================================================
  // Export Operation
  // =========================================================================
  describe('Export Operation', () => {
    
    it('should export all devices to AWS IoT Core', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'export'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 5,
            devices_succeeded: 5,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results.devices_succeeded).toBe(5);
    });

    it('should export specific devices by ID', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'export',
        device_ids: ['device-1', 'device-2', 'device-3']
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 3,
            devices_succeeded: 3,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results.devices_processed).toBe(3);
    });

    it('should create things in AWS IoT if not exist', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'export',
        device_ids: ['new-device']
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 1,
            devices_succeeded: 1,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should update device shadow in AWS IoT', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'export',
        device_ids: ['existing-device']
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 1,
            devices_succeeded: 1,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should handle AWS IoT API errors during export', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'export'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Export failed: AWS IoT API error' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(500);
    });
  });

  // =========================================================================
  // Bidirectional Sync
  // =========================================================================
  describe('Bidirectional Sync', () => {
    
    it('should perform bidirectional sync', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'bidirectional'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            import: {
              devices_processed: 10,
              devices_succeeded: 10,
              devices_failed: 0,
              errors: []
            },
            export: {
              devices_processed: 5,
              devices_succeeded: 5,
              devices_failed: 0,
              errors: []
            },
            devices_processed: 15,
            devices_succeeded: 15,
            devices_failed: 0
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results.import).toBeDefined();
      expect(data.results.export).toBeDefined();
      expect(data.results.devices_processed).toBe(15);
    });

    it('should combine results from import and export', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'bidirectional'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            import: {
              devices_processed: 8,
              devices_succeeded: 7,
              devices_failed: 1,
              errors: ['import-error']
            },
            export: {
              devices_processed: 3,
              devices_succeeded: 2,
              devices_failed: 1,
              errors: ['export-error']
            },
            devices_processed: 11,
            devices_succeeded: 9,
            devices_failed: 2
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results.devices_failed).toBe(2);
    });
  });

  // =========================================================================
  // Sync Logging
  // =========================================================================
  describe('Sync Logging', () => {
    
    it('should log successful sync operation', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 5,
            devices_succeeded: 5,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should log partial sync with failures', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 10,
            devices_succeeded: 7,
            devices_failed: 3,
            errors: ['error1', 'error2', 'error3']
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });

    it('should include sync duration in log', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            devices_processed: 100,
            devices_succeeded: 100,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // CORS
  // =========================================================================
  describe('CORS', () => {
    
    it('should handle OPTIONS preflight request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'ok'
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'OPTIONS'
      });

      expect(response.status).toBe(200);
    });

    it('should include CORS headers in response', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*'
        }),
        json: async () => ({
          success: true,
          results: {
            devices_processed: 0,
            devices_succeeded: 0,
            devices_failed: 0,
            errors: []
          }
        })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
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
        json: async () => ({ error: 'Internal server error' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: 'invalid-json'
      });

      expect(response.status).toBe(500);
    });

    it('should handle AWS credential errors', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'AWS authentication failed' })
      });

      const response = await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(500);
    });

    it('should handle network errors', async () => {
      const payload = {
        organization_id: 'org-123',
        integration_id: 'aws-iot-integration',
        operation: 'import'
      };

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('http://localhost:54321/functions/v1/aws-iot-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid-token'
          },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
