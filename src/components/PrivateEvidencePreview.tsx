import { useEffect, useState } from 'react'
import { ApiError } from '../services/api'

export function PrivateEvidencePreview({
  loadEvidence,
  alt,
  onUnauthorized,
}: {
  loadEvidence: () => Promise<Blob>
  alt: string
  onUnauthorized: () => void
}) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function togglePreview() {
    if (previewUrl) {
      setOpen((current) => !current)
      return
    }

    setLoading(true)
    setError('')
    try {
      setPreviewUrl(URL.createObjectURL(await loadEvidence()))
      setOpen(true)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load photo evidence.',
      )
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorized()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="private-evidence">
      <button
        type="button"
        className="text-button"
        onClick={() => void togglePreview()}
        disabled={loading}
      >
        {loading
          ? 'Loading evidence…'
          : open
            ? 'Hide photographic evidence'
            : 'View photographic evidence'}
      </button>
      {error && <p className="citizen-alert" role="alert">{error}</p>}
      {open && previewUrl && (
        <img className="private-evidence-preview" src={previewUrl} alt={alt} />
      )}
    </div>
  )
}
