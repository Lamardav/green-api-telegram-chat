import { useEffect, useReducer, useState } from 'react'
import { chatReducer, initialChatsState } from '../domain/chatReducer'
import { loadChats, saveChats } from '../services/storage'

/** Chat state restored from and saved to localStorage for one instance. */
export function usePersistedChats(idInstance: string) {
  const [state, dispatch] = useReducer(
    chatReducer,
    idInstance,
    (id) => loadChats(id) ?? initialChatsState,
  )
  const [storageOk, setStorageOk] = useState(true)

  useEffect(() => {
    // Mirrors the outcome of an external write (quota, disabled storage) into the UI.
    // oxlint-disable-next-line react/set-state-in-effect
    setStorageOk(saveChats(idInstance, state))
  }, [idInstance, state])

  return { state, dispatch, storageOk }
}
