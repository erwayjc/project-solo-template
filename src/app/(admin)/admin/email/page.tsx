import { getSequences, getAllSequenceSteps, getBroadcasts } from '@/actions/email'
import { EmailSequencesManager } from '@/components/admin/email-sequences-manager'
import { BroadcastsManager } from '@/components/admin/broadcasts-manager'
import { IntegrationGate } from '@/components/shared/integration-gate'

export const metadata = { title: 'Email Marketing - Admin' }

export default async function EmailPage() {
  const resendConnected = !!process.env.RESEND_API_KEY

  const [sequences, allSteps, broadcasts] = await Promise.all([
    getSequences(),
    getAllSequenceSteps(),
    getBroadcasts(),
  ])

  // Group steps by sequence_id (single query, no N+1)
  const stepsBySequenceId = new Map<string, typeof allSteps>()
  for (const step of allSteps) {
    const existing = stepsBySequenceId.get(step.sequence_id) ?? []
    existing.push(step)
    stepsBySequenceId.set(step.sequence_id, existing)
  }

  const sequencesWithSteps = sequences.map((seq) => ({
    ...seq,
    steps: stepsBySequenceId.get(seq.id) ?? [],
  }))

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-gray-900">Email Marketing</h1>
      <IntegrationGate integration="resend" isConnected={resendConnected}>
        <EmailSequencesManager initialSequences={sequencesWithSteps} />
        <BroadcastsManager initialBroadcasts={broadcasts} />
      </IntegrationGate>
    </div>
  )
}
