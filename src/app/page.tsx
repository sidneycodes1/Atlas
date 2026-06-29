'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'

export default function Home() {
  const router = useRouter()
  const { ready, authenticated, login } = usePrivy()

  useEffect(() => {
    if (!ready) return
    if (authenticated) {
      router.replace('/dashboard')
    }
  }, [ready, authenticated, router])

  if (!ready) return null

  if (authenticated) return null

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ color: '#F0C93A', fontSize: '3rem', marginBottom: '0.5rem' }}>
        ATLAS.
      </h1>
      <p style={{ color: '#888', marginBottom: '2rem', fontSize: '1rem' }}>
        Autonomous Solana Transaction Recovery
      </p>
      <button
        onClick={login}
        style={{
          background: '#F0C93A',
          color: '#000',
          border: 'none',
          padding: '0.75rem 2rem',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontFamily: 'monospace'
        }}
      >
        SIGN IN WITH GOOGLE
      </button>
    </div>
  )
}
