import type { ImportPreviewRow } from '@/lib/validators/import'
import { STATUS_LABELS_ES } from '@/lib/constants/finding-options'

interface PreviewTableProps {
  rows: ImportPreviewRow[]
}

export function PreviewTable({ rows }: PreviewTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#dbe4dd] bg-white">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-[#dbe4dd] bg-[#f7faf5]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-[#65766e]">Fila</th>
            <th className="px-4 py-3 text-left font-semibold text-[#65766e]">Observación</th>
            <th className="px-4 py-3 text-left font-semibold text-[#65766e]">Área</th>
            <th className="px-4 py-3 text-left font-semibold text-[#65766e]">Estado</th>
            <th className="px-4 py-3 text-left font-semibold text-[#65766e]">Evidencia</th>
            <th className="px-4 py-3 text-left font-semibold text-[#65766e]">Importación</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, idx) => (
            <tr key={idx} className="border-b border-[#edf4ed] last:border-b-0">
              <td className="px-4 py-3 text-[#65766e]">{row.sourceRow}</td>
              <td className="max-w-xs truncate px-4 py-3 font-medium text-[#17251f]">{row.observation}</td>
              <td className="px-4 py-3 text-[#3d4d45]">{row.area}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  row.status === 'VALIDATED' ? 'bg-[#eefbf2] text-[#0b5d38]' : 'bg-[#fff8e8] text-[#85540d]'
                }`}>
                  {STATUS_LABELS_ES[row.status as keyof typeof STATUS_LABELS_ES] ?? row.status}
                </span>
              </td>
              <td className="px-4 py-3 text-[#65766e]">{row.evidenceFiles.length} archivo(s)</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  row.isDuplicate ? 'bg-[#edf4ed] text-[#65766e]' : 'bg-[#e9f7ef] text-[#052b20]'
                }`}>
                  {row.isDuplicate ? 'Duplicado' : 'Nuevo'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {rows.length > 10 && (
        <div className="border-t border-[#dbe4dd] bg-[#f7faf5] p-3 text-center text-sm text-[#65766e]">
          Mostrando 10 de {rows.length} filas
        </div>
      )}
    </div>
  )
}
