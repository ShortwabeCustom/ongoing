export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-4 w-96 animate-pulse rounded bg-gray-200" />
        </div>

        <div className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-24 animate-pulse rounded bg-gray-200"
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg bg-gray-200"
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-96 animate-pulse rounded-lg bg-gray-200 lg:col-span-2" />
            <div className="h-96 animate-pulse rounded-lg bg-gray-200" />
          </div>

          <div className="h-64 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  )
}
