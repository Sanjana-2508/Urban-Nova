import { getPickupEvidence } from '../services/pickupRequests'
import { PrivateEvidencePreview } from './PrivateEvidencePreview'

export function PickupRequestEvidence({
  requestId,
  onUnauthorized,
}: {
  requestId: number
  onUnauthorized: () => void
}) {
  return (
    <PrivateEvidencePreview
      loadEvidence={() => getPickupEvidence(requestId)}
      alt={`Photo evidence for pickup request ${requestId}`}
      onUnauthorized={onUnauthorized}
    />
  )
}
