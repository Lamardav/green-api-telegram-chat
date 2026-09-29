import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError, isGreenApiError } from '../api/errors'
import { settingsReady } from '../api/greenApi'
import type { GreenApiClient } from '../api/types'
import type { SettingsStatus } from './chats'

/** GREEN-API applies new settings within about five minutes; until then old errors are expected. */
const APPLY_WINDOW_MS = 5 * 60_000

/**
 * Receiving through the HTTP API needs an empty webhookUrl and enabled notifications.
 * Checks that once per session and lets the user fix it with one click.
 */
export function useInstanceSettings(client: GreenApiClient, onUnauthorized: () => void) {
  const [status, setStatus] = useState<SettingsStatus>('checking')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkRun, setCheckRun] = useState(0)
  const appliedAt = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    client
      .getSettings(controller.signal)
      .then((settings) => {
        setWebhookUrl(settings.webhookUrl)
        setError(null)
        setStatus(settingsReady(settings) ? 'ready' : 'needsSetup')
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isGreenApiError(err, 'aborted')) return
        if (isGreenApiError(err, 'unauthorized')) return onUnauthorized()
        // Keep receiving anyway: the poller backs off and reports a misconfiguration itself.
        setError(describeError(err))
        setStatus('error')
      })
    return () => controller.abort()
  }, [client, onUnauthorized, checkRun])

  const recheck = useCallback(() => {
    setStatus('checking')
    setCheckRun((n) => n + 1)
  }, [])

  const enable = useCallback(async () => {
    setStatus('applying')
    setError(null)
    try {
      await client.enableHttpNotifications()
      appliedAt.current = Date.now()
      setWebhookUrl('')
      setStatus('applied')
    } catch (err) {
      if (isGreenApiError(err, 'unauthorized')) return onUnauthorized()
      setError(describeError(err))
      setStatus('needsSetup')
    }
  }, [client, onUnauthorized])

  const dismiss = useCallback(() => setStatus('ready'), [])

  /** The poller found receiving blocked by the instance settings. */
  const reportBlocked = useCallback(() => setStatus('needsSetup'), [])

  /** True right after enabling, while the instance may still answer with the old settings. */
  const isApplying = useCallback(
    () => appliedAt.current !== null && Date.now() - appliedAt.current < APPLY_WINDOW_MS,
    [],
  )

  return {
    status,
    webhookUrl,
    error,
    receiving: status === 'ready' || status === 'applied' || status === 'error',
    enable,
    recheck,
    dismiss,
    reportBlocked,
    isApplying,
  }
}
