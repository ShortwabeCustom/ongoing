'use client';

import { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConflictResolverProps {
  isOpen: boolean;
  conflict?: {
    field: string;
    clientValue: any;
    serverValue: any;
    conflictType: string;
  };
  onResolve?: (choice: 'client' | 'server' | 'merge') => void;
  onCancel?: () => void;
}

export function ConflictResolver({
  isOpen,
  conflict,
  onResolve,
  onCancel,
}: ConflictResolverProps) {
  const [selectedChoice, setSelectedChoice] = useState<
    'client' | 'server' | 'merge'
  >('merge');

  if (!isOpen || !conflict) {
    return null;
  }

  const handleResolve = () => {
    onResolve?.(selectedChoice);
  };

  const renderValue = (value: any) => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Conflicto Detectado
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Detectamos un conflicto en el campo <code className="bg-gray-100 px-2 py-1 rounded">{conflict.field}</code>.
            Por favor elige cómo resolverlo:
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Client Version */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                selectedChoice === 'client'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedChoice('client')}
            >
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="radio"
                  name="resolution"
                  value="client"
                  checked={selectedChoice === 'client'}
                  onChange={() => setSelectedChoice('client')}
                  className="w-4 h-4"
                />
                <label className="font-medium text-gray-900">
                  Tu versión
                </label>
              </div>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs text-gray-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                {renderValue(conflict.clientValue)}
              </div>
            </div>

            {/* Server Version */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                selectedChoice === 'server'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedChoice('server')}
            >
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="radio"
                  name="resolution"
                  value="server"
                  checked={selectedChoice === 'server'}
                  onChange={() => setSelectedChoice('server')}
                  className="w-4 h-4"
                />
                <label className="font-medium text-gray-900">
                  Versión del servidor
                </label>
              </div>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs text-gray-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                {renderValue(conflict.serverValue)}
              </div>
            </div>
          </div>

          {/* Merge Option */}
          <div
            className={`border-2 rounded-lg p-4 cursor-pointer transition ${
              selectedChoice === 'merge'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedChoice('merge')}
          >
            <div className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                name="resolution"
                value="merge"
                checked={selectedChoice === 'merge'}
                onChange={() => setSelectedChoice('merge')}
                className="w-4 h-4"
              />
              <label className="font-medium text-gray-900">Combinar</label>
            </div>
            <p className="text-xs text-gray-600">
              Se fusionarán ambas versiones, priorizando valores válidos del servidor
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
          <button
            onClick={handleResolve}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded transition flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Resolver
          </button>
        </div>
      </div>
    </div>
  );
}
