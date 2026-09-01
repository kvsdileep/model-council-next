'use client'

import { useState } from 'react'
import { TerminalWindow } from '@/components/terminal/TerminalWindow'
import { QueryScreen } from '@/components/screens/QueryScreen'

export default function Home() {
  const [query, setQuery] = useState<string | null>(null)

  return (
    <TerminalWindow path="~/session" statusLabel="idle" statusTone="ok">
      {query ? <p style={{ color: 'var(--sage)' }}>convening: {query}</p> : <QueryScreen onSubmit={setQuery} />}
    </TerminalWindow>
  )
}
