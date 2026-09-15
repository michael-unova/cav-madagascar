import { useCallback, useEffect, useRef, useState } from 'react'
import { getFirestoreErrorMessage } from '../lib/firebase/firestoreErrors'

export interface AsyncData<TData> {
  data: TData | null
  isLoading: boolean
  /** A French, user-facing message, or null when the last load succeeded. */
  errorMessage: string | null
  /** Re-runs the loader, for example after a create, edit, or delete. */
  refresh: () => void
}

interface LoadResult<TData> {
  signature: string
  data: TData | null
  errorMessage: string | null
}

/**
 * Runs an async loader and exposes the loading, error, and success states
 * the interface needs, so every data-backed page handles all three instead
 * of only the happy path.
 *
 * `keys` behaves like a dependency array and must contain primitives: the
 * loader re-runs whenever one of them changes. Each result is tagged with
 * the keys it was loaded for, so a slow request that resolves after the
 * keys changed is ignored rather than shown against the wrong input, and
 * loading is derived from that tag rather than set from inside the effect.
 */
export function useAsyncData<TData>(loader: () => Promise<TData>, keys: unknown[]): AsyncData<TData> {
  const [reloadToken, setReloadToken] = useState(0)
  const [result, setResult] = useState<LoadResult<TData> | null>(null)

  const signature = `${keys.map((key) => String(key)).join('|')}#${reloadToken}`

  // Keeping the latest loader in a ref lets callers pass an inline closure
  // without the closure's identity re-triggering the fetch below. The ref
  // is written from an effect, never during render.
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  })

  useEffect(() => {
    let isCurrent = true

    loaderRef
      .current()
      .then((data) => {
        if (isCurrent) setResult({ signature, data, errorMessage: null })
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setResult({ signature, data: null, errorMessage: getFirestoreErrorMessage(error) })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [signature])

  const refresh = useCallback(() => setReloadToken((token) => token + 1), [])

  const isLoading = result?.signature !== signature

  return {
    data: isLoading ? null : (result?.data ?? null),
    isLoading,
    errorMessage: isLoading ? null : (result?.errorMessage ?? null),
    refresh,
  }
}
