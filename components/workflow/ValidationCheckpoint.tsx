'use client'

import { useState, useCallback } from 'react'
import { Finding } from '@/lib/generated/prisma'
import { WorkflowClient } from '@/lib/api/workflow-client'
import { ValidationCriterion, ValidationResult } from '@/lib/validators/workflow'
import { toast } from '@/components/ui/use-toast'

interface ValidationCheckpointProps {
  finding: Finding & { validations?: any[] }
  onValidation?: (result: ValidationResult) => Promise<void>
  readOnly?: boolean
}

export function ValidationCheckpoint({
  finding,
  onValidation,
  readOnly = false,
}: ValidationCheckpointProps) {
  const [validations, setValidations] = useState(finding.validations ?? [])
  const [activeValId, setActiveValId] = useState<string | null>(
    validations[0]?.id ?? null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [criteria, setCriteria] = useState<ValidationCriterion[]>([
    { id: '1', name: 'All issues documented', passed: undefined },
    { id: '2', name: 'Evidence is complete', passed: undefined },
    { id: '3', name: 'Resolution is clear', passed: undefined },
  ])

  const activeValidation = validations.find((v) => v.id === activeValId)
  const isPending = activeValidation?.result === 'PENDING'
  const allCriteriaAnswered = criteria.every((c) => c.passed !== undefined)

  const handleCheckValidation = useCallback(async () => {
    if (!activeValidation || !allCriteriaAnswered) {
      toast({ title: 'Error', description: 'Complete all criteria' })
      return
    }

    try {
      setIsLoading(true)
      const results = Object.fromEntries(
        criteria.map((c) => [c.id, c.passed === true]),
      )

      const response = await WorkflowClient.checkValidation(
        finding.id,
        activeValidation.id,
        { results },
      )

      if (response.status === 'success') {
        setValidations(
          validations.map((v) =>
            v.id === activeValidation.id ? response.data : v,
          ),
        )
        toast({ title: 'Success', description: `Validation: ${response.data.result}` })
        await onValidation?.(response.data.result)
      } else {
        toast({ title: 'Error', description: response.message })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to validate' })
    } finally {
      setIsLoading(false)
    }
  }, [finding.id, activeValidation, criteria, allCriteriaAnswered, onValidation, validations])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Validation Checkpoint</h3>

        {/* Validation history */}
        {validations.length > 0 && (
          <div className="space-y-2 mb-4">
            {validations.map((val) => (
              <button
                key={val.id}
                onClick={() => setActiveValId(val.id)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${
                  activeValId === val.id
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      Validation #{validations.indexOf(val) + 1}
                    </p>
                    <p className="text-xs text-gray-500">
                      {val.validatedAt
                        ? new Date(val.validatedAt).toLocaleDateString()
                        : 'Pending'}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      val.result === 'PASS'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : val.result === 'FAIL'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {val.result}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active validation details */}
      {activeValidation && (
        <div className="border rounded-lg p-4 space-y-4">
          {isPending ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please review each criterion:
              </p>

              {/* Criteria checklist */}
              <div className="space-y-3">
                {criteria.map((criterion) => (
                  <div
                    key={criterion.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{criterion.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setCriteria(
                            criteria.map((c) =>
                              c.id === criterion.id ? { ...c, passed: true } : c,
                            ),
                          )
                        }
                        className={`px-3 py-1 text-xs font-medium rounded ${
                          criterion.passed === true
                            ? 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        Pass
                      </button>
                      <button
                        onClick={() =>
                          setCriteria(
                            criteria.map((c) =>
                              c.id === criterion.id ? { ...c, passed: false } : c,
                            ),
                          )
                        }
                        className={`px-3 py-1 text-xs font-medium rounded ${
                          criterion.passed === false
                            ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        Fail
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit validation */}
              {!readOnly && (
                <button
                  onClick={handleCheckValidation}
                  disabled={isLoading || !allCriteriaAnswered}
                  className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? 'Validating...' : 'Submit Validation'}
                </button>
              )}
            </>
          ) : (
            <div>
              <p className="text-sm font-medium mb-3">Validation Result: {activeValidation.result}</p>
              {activeValidation.criteria && (
                <div className="space-y-2 text-sm">
                  {activeValidation.criteria.map((c: ValidationCriterion, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className={`text-lg ${
                          c.passed ? '✓ text-green-600' : c.passed === false ? '✗ text-red-600' : '○'
                        }`}
                      >
                        {c.passed ? '✓' : c.passed === false ? '✗' : '○'}
                      </span>
                      <span>{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
