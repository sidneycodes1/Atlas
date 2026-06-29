'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'

export default function Home() {
  const router = useRouter()
  const { ready, authenticated } = usePrivy()

  useEffect(() => {
    if (!ready) return
    if (authenticated) {
      router.replace('/dashboard')
    }
  }, [ready, authenticated, router])

  return null
}
