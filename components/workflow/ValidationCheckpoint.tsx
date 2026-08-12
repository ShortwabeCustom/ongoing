'use client'

import { useState, useCallback } from 'react'
import { Finding } from '@/lib/generated/prisma/client'
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
    { id: '1', name: 'Hallazgos documentados', passed: undefined },
    { id: '2', name: 'Evidencia completa', passed: undefined },
    { id: '3', name: 'Resolución clara', passed: undefined },
  ])

  const activeValidation = validations.find((v) => v.id === activeValId)
  const isPending = activeValidation?.result === 'PENDING'
  const allCriteriaAnswered = criteria.every((c) => c.passed !== undefined)

  const handleCheckValidation = useCallback(async () => {
    if (!activeValidation || !allCriteriaAnswered) {
      toast({ title: 'Error', description: 'Completa todos los criterios' })
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
        toast({ title: 'Listo', description: `Validación: ${response.data.result}` })
        await onValidation?.(response.data.result)
      } else {
        toast({ title: 'Error', description: response.message })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo validar' })
    } finally {
      setIsLoading(false)
    }
  }, [finding.id, activeValidation, criteria, allCriteriaAnswered, onValidation, validations])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-xl font-bold text-[#17251f]">Checkpoint de validación</h3>

        {/* Validation history */}
        {validations.length > 0 && (
          <div className="mb-4 space-y-2">
            {validations.map((val) => (
              <button
                key={val.id}
                onClick={() => setActiveValId(val.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  activeValId === val.id
                    ? 'border-[#00a85a] bg-[#f3fbf5]'
                    : 'border-[#dbe4dd] bg-white hover:border-[#b9c8c0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#17251f]">
                      Validación #{validations.indexOf(val) + 1}
                    </p>
                    <p className="text-xs text-[#65766e]">
                      {val.validatedAt
                        ? (typeof val.validatedAt === 'string' ? new Date(val.validatedAt).toLocaleDateString('es-ES') : (val.validatedAt instanceof Date ? val.validatedAt.toLocaleDateString('es-ES') : 'Pendiente'))
                        : 'Pendiente'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      val.result === 'PASS'
                        ? 'bg-[#eefbf2] text-[#0b5d38]'
                        : val.result === 'FAIL'
                          ? 'bg-[#fff1ee] text-[#9b321f]'
                          : 'bg-[#edf4ed] text-[#65766e]'
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
        <div className="space-y-4 rounded-lg border border-[#dbe4dd] bg-[#f7faf5] p-4">
          {isPending ? (
            <>
              <p className="text-sm text-[#65766e]">
                Revisión de criterios
              </p>

              {/* Criteria checklist */}
              <div className="space-y-3">
                {criteria.map((criterion) => (
                  <div
                    key={criterion.id}
                    className="flex items-center gap-3 rounded-lg border border-[#dbe4dd] bg-white p-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#17251f]">{criterion.name}</p>
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
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          criterion.passed === true
                            ? 'bg-[#eefbf2] text-[#0b5d38]'
                            : 'bg-[#edf4ed] text-[#65766e]'
                        }`}
                      >
                        Pasa
                      </button>
                      <button
                        onClick={() =>
                          setCriteria(
                            criteria.map((c) =>
                              c.id === criterion.id ? { ...c, passed: false } : c,
                            ),
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          criterion.passed === false
                            ? 'bg-[#fff1ee] text-[#9b321f]'
                            : 'bg-[#edf4ed] text-[#65766e]'
                        }`}
                      >
                        Falla
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
                  className="w-full rounded-full bg-[#052b20] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b3e30] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? 'Validando...' : 'Enviar validación'}
                </button>
              )}
            </>
          ) : (
            <div>
              <p className="mb-3 text-sm font-semibold text-[#17251f]">
                Resultado de validación: {activeValidation.result}
              </p>
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
                      <span className="text-[#3d4d45]">{c.name}</span>
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
