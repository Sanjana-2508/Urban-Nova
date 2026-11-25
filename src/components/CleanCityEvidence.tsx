import { getCleanCityEvidence } from '../services/cleancity'
import { PrivateEvidencePreview } from './PrivateEvidencePreview'

export function CleanCityEvidence({
  reportId,
  onUnauthorized,
}: {
  reportId: number
  onUnauthorized: () => void
}) {
  return (
    <PrivateEvidencePreview
      loadEvidence={() => getCleanCityEvidence(reportId)}
      alt={`Photo evidence for CleanCity report ${reportId}`}
      onUnauthorized={onUnauthorized}
    />
  )
}
