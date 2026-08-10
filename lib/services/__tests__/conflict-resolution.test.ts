import { describe, it, expect } from 'vitest';
import { ConflictResolutionService } from '../conflict-resolution';

describe('ConflictResolutionService', () => {
  describe('detectConflict', () => {
    it('should detect version mismatch', () => {
      const result = ConflictResolutionService.detectConflict(1, 2);

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('version_mismatch');
      expect(result.clientVersion).toBe(1);
      expect(result.serverVersion).toBe(2);
    });

    it('should not detect conflict when versions match', () => {
      const result = ConflictResolutionService.detectConflict(2, 2);

      expect(result.hasConflict).toBe(false);
      expect(result.conflictType).toBe('none');
    });
  });

  describe('applyOperationalTransform', () => {
    it('should merge operations in timestamp order', () => {
      const ops = [
        {
          userId: 'user-1',
          timestamp: new Date('2026-08-10T10:00:00'),
          changes: { status: 'OPEN' },
        },
        {
          userId: 'user-2',
          timestamp: new Date('2026-08-10T10:00:01'),
          changes: { status: 'IN_PROGRESS' },
        },
      ];

      const result = ConflictResolutionService.applyOperationalTransform(ops);

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should handle empty operations', () => {
      const result = ConflictResolutionService.applyOperationalTransform([]);

      expect(result).toEqual({});
    });
  });

  describe('resolveConflict', () => {
    const clientData = { status: 'CLOSED', priority: 'HIGH' };
    const serverData = { status: 'IN_PROGRESS', priority: 'MEDIUM' };

    it('should apply client_wins strategy', () => {
      const result = ConflictResolutionService.resolveConflict(
        clientData,
        serverData,
        'client_wins'
      );

      expect(result).toEqual(clientData);
    });

    it('should apply server_wins strategy', () => {
      const result = ConflictResolutionService.resolveConflict(
        clientData,
        serverData,
        'server_wins'
      );

      expect(result).toEqual(serverData);
    });

    it('should apply lww (Last Write Wins) strategy', () => {
      const result = ConflictResolutionService.resolveConflict(
        clientData,
        serverData,
        'lww'
      );

      expect(result).toEqual(serverData);
    });

    it('should apply merge strategy', () => {
      const result = ConflictResolutionService.resolveConflict(
        clientData,
        serverData,
        'merge'
      );

      expect(result.status).toBe('CLOSED');
      expect(result.priority).toBe('HIGH');
    });
  });

  describe('validateUpdate', () => {
    it('should validate update with valid data', () => {
      const result = ConflictResolutionService.validateUpdate('user-1', 'finding-123', 1);

      expect(result).toBe(true);
    });

    it('should reject update without userId', () => {
      const result = ConflictResolutionService.validateUpdate('', 'finding-123', 1);

      expect(result).toBe(false);
    });

    it('should reject update without resourceId', () => {
      const result = ConflictResolutionService.validateUpdate('user-1', '', 1);

      expect(result).toBe(false);
    });

    it('should reject update with negative version', () => {
      const result = ConflictResolutionService.validateUpdate('user-1', 'finding-123', -1);

      expect(result).toBe(false);
    });
  });

  describe('detectFieldConflicts', () => {
    it('should detect conflicting fields', () => {
      const clientData = { status: 'CLOSED', priority: 'HIGH' };
      const serverData = { status: 'IN_PROGRESS', priority: 'HIGH' };

      const conflicts = ConflictResolutionService.detectFieldConflicts(
        clientData,
        serverData
      );

      expect(conflicts).toContain('status');
      expect(conflicts).not.toContain('priority');
    });

    it('should return empty array when no conflicts', () => {
      const clientData = { status: 'IN_PROGRESS' };
      const serverData = { status: 'IN_PROGRESS' };

      const conflicts = ConflictResolutionService.detectFieldConflicts(
        clientData,
        serverData
      );

      expect(conflicts).toEqual([]);
    });
  });

  describe('mergeFields', () => {
    it('should prefer client values for conflicting fields', () => {
      const clientData = { status: 'CLOSED' };
      const serverData = { status: 'IN_PROGRESS', priority: 'MEDIUM' };
      const conflicts = ['status'];

      const result = ConflictResolutionService.mergeFields(
        clientData,
        serverData,
        conflicts
      );

      expect(result.status).toBe('CLOSED');
      expect(result.priority).toBe('MEDIUM');
    });

    it('should preserve null values in client data', () => {
      const clientData = { status: null, priority: 'HIGH' };
      const serverData = { status: 'IN_PROGRESS', priority: 'MEDIUM' };
      const conflicts = ['status', 'priority'];

      const result = ConflictResolutionService.mergeFields(
        clientData,
        serverData,
        conflicts
      );

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.priority).toBe('HIGH');
    });
  });
});
