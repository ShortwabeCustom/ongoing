import type { ImportPreviewRow } from '@/lib/validators/import'

interface PreviewTableProps {
  rows: ImportPreviewRow[]
}

export function PreviewTable({ rows }: PreviewTableProps) {
  return (
    <div className="overflow-x-auto border border-gray-300 rounded">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">Row</th>
            <th className="px-4 py-2 text-left font-semibold">Observation</th>
            <th className="px-4 py-2 text-left font-semibold">Area</th>
            <th className="px-4 py-2 text-left font-semibold">Status</th>
            <th className="px-4 py-2 text-left font-semibold">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-2 text-gray-600">{row.sourceRow}</td>
              <td className="px-4 py-2 truncate max-w-xs">{row.observation}</td>
              <td className="px-4 py-2">{row.area}</td>
              <td className="px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  row.status === 'VALIDATED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {row.status}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-600">{row.evidenceFiles.length} file(s)</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && (
        <div className="p-3 bg-gray-50 border-t text-sm text-gray-600 text-center">
          Showing 10 of {rows.length} rows
        </div>
      )}
    </div>
  )
}
