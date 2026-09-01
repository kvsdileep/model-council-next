'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CommandLine } from '@/components/terminal/CommandLine'
import { DraftColumn } from '@/components/deliberation/DraftColumn'
import { CritiqueList } from '@/components/deliberation/CritiqueList'
import { useCouncilStream } from '@/lib/useCouncilStream'
import { DEFAULT_CONFIG } from '@/council/config'
import styles from '@/components/deliberation/deliberation.module.css'

export function DeliberationScreen({ query }: { query: string }) {
  const { state, start } = useCouncilStream()
  const router = useRouter()

  useEffect(() => {
    void start(query, DEFAULT_CONFIG)
  }, [query, start])

  // The verdict lives at its own URL so the run is shareable — spec section 14.
  useEffect(() => {
    if (state.status === 'done' && state.runId) router.push(`/run/${state.runId}`)
  }, [state.status, state.runId, router])

  return (
    <>
      <CommandLine command="council dispatch --seats 3 --blind" />
      <div className={styles.columns}>
        {DEFAULT_CONFIG.drafters.map((seat) => (
          <DraftColumn key={seat.id} seat={seat} view={state.drafts[seat.id]} />
        ))}
      </div>

      {state.stage === 'critique' || Object.keys(state.critiques).length > 0 ? (
        <>
          <CommandLine command="council critique --anonymize --shuffle" />
          <CritiqueList critiques={state.critiques} />
        </>
      ) : null}

      {state.stage === 'judge' ? (
        <>
          <CommandLine command="council judge --strict" />
          <p className={styles.spinner}>deliberating [/-\|] synthesizing verdict...</p>
        </>
      ) : null}

      {state.status === 'failed' ? (
        <p style={{ color: 'var(--danger)', marginTop: 20 }}>[!] run failed: {state.error}</p>
      ) : null}
    </>
  )
}
