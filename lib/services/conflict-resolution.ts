export interface ConflictInfo {
  hasConflict: boolean;
  clientVersion: number;
  serverVersion: number;
  conflictType: 'version_mismatch' | 'field_conflict' | 'none';
}

export interface Operation {
  userId: string;
  timestamp: Date;
  changes: Record<string, any>;
}

export type ConflictStrategy = 'client_wins' | 'server_wins' | 'merge' | 'lww';

export class ConflictResolutionService {
  static detectConflict(
    clientVersion: number,
    serverVersion: number
  ): ConflictInfo {
    const hasConflict = clientVersion !== serverVersion;

    return {
      hasConflict,
      clientVersion,
      serverVersion,
      conflictType: hasConflict ? 'version_mismatch' : 'none',
    };
  }

  static applyOperationalTransform(ops: Operation[]): Record<string, any> {
    if (ops.length === 0) return {};

    // Sort by timestamp to apply in order
    const sorted = [...ops].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Merge changes - later changes override earlier ones
    const merged: Record<string, any> = {};
    for (const op of sorted) {
      Object.assign(merged, op.changes);
    }

    return merged;
  }

  static resolveConflict(
    clientData: Record<string, any>,
    serverData: Record<string, any>,
    strategy: ConflictStrategy
  ): Record<string, any> {
    switch (strategy) {
      case 'client_wins':
        return clientData;

      case 'server_wins':
        return serverData;

      case 'lww': // Last Write Wins
        return serverData; // Server is authoritative

      case 'merge':
        // Deep merge: server data as base, client changes applied
        return {
          ...serverData,
          ...clientData,
        };

      default:
        return serverData;
    }
  }

  static validateUpdate(
    userId: string,
    resourceId: string,
    version: number
  ): boolean {
    // In a real implementation, this would check against the database
    // For now, just validate that required fields exist
    return !!(userId && resourceId && version >= 0);
  }

  static detectFieldConflicts(
    clientData: Record<string, any>,
    serverData: Record<string, any>
  ): string[] {
    const conflicts: string[] = [];

    // Check each field to see if both client and server modified it
    for (const key of Object.keys(clientData)) {
      if (
        key in serverData &&
        JSON.stringify(clientData[key]) !== JSON.stringify(serverData[key])
      ) {
        conflicts.push(key);
      }
    }

    return conflicts;
  }

  static mergeFields(
    clientData: Record<string, any>,
    serverData: Record<string, any>,
    conflicts: string[]
  ): Record<string, any> {
    const merged = { ...serverData };

    // For conflicting fields, prefer non-null values
    for (const field of conflicts) {
      if (clientData[field] !== null && clientData[field] !== undefined) {
        merged[field] = clientData[field];
      }
    }

    // Add non-conflicting client changes
    for (const key of Object.keys(clientData)) {
      if (!conflicts.includes(key)) {
        merged[key] = clientData[key];
      }
    }

    return merged;
  }
}
