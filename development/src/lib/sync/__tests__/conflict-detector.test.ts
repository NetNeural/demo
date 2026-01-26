/**
 * Conflict Detector Tests (Issue #87)
 */

import { ConflictDetector } from '../conflict-detector';

describe('ConflictDetector', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  describe('detectConflicts', () => {
    it('should detect conflicts in changed fields', () => {
      const localDevice = {
        name: 'Local Name',
        status: 'online',
        battery_level: 80
      };

      const remoteDevice = {
        name: 'Remote Name',
        status: 'offline',
        battery_level: 75
      };

      const conflicts = detector.detectConflicts(localDevice, remoteDevice);

      expect(conflicts).toHaveLength(3);
      expect(conflicts.find(c => c.fieldName === 'name')).toBeDefined();
      expect(conflicts.find(c => c.fieldName === 'status')).toBeDefined();
      expect(conflicts.find(c => c.fieldName === 'battery_level')).toBeDefined();
    });

    it('should not detect conflicts for identical fields', () => {
      const localDevice = {
        name: 'Same Name',
        status: 'online'
      };

      const remoteDevice = {
        name: 'Same Name',
        status: 'online'
      };

      const conflicts = detector.detectConflicts(localDevice, remoteDevice);

      expect(conflicts).toHaveLength(0);
    });

    it('should recommend correct merge strategies', () => {
      const localDevice = {
        name: 'User Name', // prefer_local
        status: 'offline', // prefer_remote
        tags: ['local'], // merge
        metadata: { custom: 'data' } // manual
      };

      const remoteDevice = {
        name: 'Remote Name',
        status: 'online',
        tags: ['remote'],
        metadata: { different: 'data' }
      };

      const conflicts = detector.detectConflicts(localDevice, remoteDevice);

      const nameConflict = conflicts.find(c => c.fieldName === 'name');
      expect(nameConflict?.recommendedStrategy).toBe('prefer_local');

      const statusConflict = conflicts.find(c => c.fieldName === 'status');
      expect(statusConflict?.recommendedStrategy).toBe('prefer_remote');

      const tagsConflict = conflicts.find(c => c.fieldName === 'tags');
      expect(tagsConflict?.recommendedStrategy).toBe('merge');

      const metadataConflict = conflicts.find(c => c.fieldName === 'metadata');
      expect(metadataConflict?.recommendedStrategy).toBe('manual');
    });
  });
});
