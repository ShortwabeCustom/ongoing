import { redirect } from 'next/navigation'

/**
 * The report itself is a self-contained offline bundle served from
 * `public/app.html`. `next.config.mjs` rewrites `/` straight to it, so this
 * route only runs where rewrites are not applied — it forwards there instead
 * of rendering a placeholder.
 */
export default function Page() {
  redirect('/app.html')
}
