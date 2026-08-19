'use client'

import { FormEvent, useMemo, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type CommentAuthor = {
  id: string
  name: string | null
  email: string
}

export type FindingComment = {
  id: string
  text: string
  createdAt: string | Date
  updatedAt: string | Date
  creator: CommentAuthor
}

type FindingCommentsProps = {
  findingId: string
  initialComments?: FindingComment[]
}

const COMMENT_ROLES = ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER']

function authorName(comment: FindingComment) {
  return comment.creator.name?.trim() || comment.creator.email
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formattedDate(value: string | Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function FindingComments({ findingId, initialComments = [] }: FindingCommentsProps) {
  const { user, loading: authLoading } = useAuth()
  const [comments, setComments] = useState(initialComments)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orderedComments = useMemo(
    () => [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [comments],
  )
  const canComment = Boolean(user?.role && COMMENT_ROLES.includes(user.role))

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextText = text.trim()
    if (!nextText || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/findings/${findingId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nextText }),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.message ?? 'No se pudo publicar el comentario')

      setComments((current) => [...current, result])
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar el comentario')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="pm-card overflow-hidden" aria-labelledby="finding-comments-title">
      <div className="flex items-start justify-between gap-4 border-b border-[#e1e8e3] px-6 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e0f5e9] text-[#052b20]">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="finding-comments-title" className="text-xl font-bold text-[#17251f]">Comentarios del hallazgo</h3>
            <p className="mt-0.5 text-sm text-[#65766e]">Conversación y acuerdos del equipo</p>
          </div>
        </div>
        <span className="rounded-full border border-[#dbe4dd] bg-[#f7faf8] px-3 py-1 text-xs font-semibold text-[#3d4d45]">
          {comments.length} {comments.length === 1 ? 'comentario' : 'comentarios'}
        </span>
      </div>

      <div className="px-6 py-6 md:px-8">
        {orderedComments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#cbd8d0] bg-[#f7faf8] px-5 py-8 text-center">
            <p className="font-semibold text-[#17251f]">Todavía no hay comentarios</p>
            <p className="mt-1 text-sm text-[#65766e]">Inicia la conversación para compartir contexto, avances o acuerdos.</p>
          </div>
        ) : (
          <ol className="space-y-5">
            {orderedComments.map((comment) => {
              const name = authorName(comment)
              return (
                <li key={comment.id} className="flex gap-3 md:gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#052b20] text-xs font-bold text-white" aria-hidden="true">
                    {initials(name)}
                  </div>
                  <article className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-[#e1e8e3] bg-[#f7faf8] px-4 py-3.5">
                    <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-sm font-bold text-[#17251f]">{name}</p>
                      <time className="text-xs text-[#7a8981]" dateTime={new Date(comment.createdAt).toISOString()}>
                        {formattedDate(comment.createdAt)} UTC
                      </time>
                    </header>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#3b4b43]">{comment.text}</p>
                  </article>
                </li>
              )
            })}
          </ol>
        )}

        {!authLoading && canComment && (
          <form onSubmit={submitComment} className="mt-6 border-t border-[#e1e8e3] pt-5">
            <label htmlFor="finding-comment" className="mb-2 block text-sm font-semibold text-[#17251f]">Agregar comentario</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <textarea
                  id="finding-comment"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Escribe un comentario para el equipo…"
                  className="block w-full resize-y rounded-xl border border-[#cbd8d0] bg-white px-4 py-3 text-sm leading-6 text-[#17251f] outline-none transition placeholder:text-[#8b9991] focus:border-[#00a85a] focus:ring-2 focus:ring-[#00a85a]/20"
                />
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs text-[#7a8981]">Visible para todos los colaboradores del hallazgo.</p>
                  <span className="shrink-0 text-xs tabular-nums text-[#7a8981]">{text.length}/2000</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={!text.trim() || submitting}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#052b20] px-5 text-sm font-semibold text-white transition hover:bg-[#0b3e30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a85a] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {submitting ? 'Publicando…' : 'Publicar'}
              </button>
            </div>
            {error && <p role="alert" className="mt-3 rounded-lg border border-[#f6b5aa] bg-[#fff1ee] px-3 py-2 text-sm text-[#9b321f]">{error}</p>}
          </form>
        )}
      </div>
    </section>
  )
}
