import { ref, type Ref } from 'vue'
import { useProjectStore } from '@/stores/project'

export type UnsavedChangesReason = 'close' | 'import-image' | 'open-project' | 'clear'
export type GuardedAction = () => Promise<boolean>

interface PendingAction {
  action: GuardedAction
  resolve: (completed: boolean) => void
}

export interface UnsavedChangesGuard {
  open: Ref<boolean>
  saving: Ref<boolean>
  reason: Ref<UnsavedChangesReason>
  request: (reason: UnsavedChangesReason, action: GuardedAction) => Promise<boolean>
  saveAndContinue: () => Promise<void>
  discardAndContinue: () => Promise<void>
  cancel: () => void
  setSaveCurrent: (saveCurrent: GuardedAction) => void
}

interface DirtyState {
  dirty: boolean
}

export function createUnsavedChangesGuard(
  store: DirtyState,
  initialSaveCurrent?: GuardedAction,
): UnsavedChangesGuard {
  const open = ref(false)
  const saving = ref(false)
  const reason = ref<UnsavedChangesReason>('close')
  let pending: PendingAction | undefined
  let saveCurrent = initialSaveCurrent

  async function executePending(): Promise<void> {
    const current = pending
    pending = undefined
    open.value = false
    if (!current) return
    try {
      current.resolve(await current.action())
    } catch {
      current.resolve(false)
    }
  }

  function cancel(): void {
    const current = pending
    pending = undefined
    open.value = false
    current?.resolve(false)
  }

  async function request(nextReason: UnsavedChangesReason, action: GuardedAction): Promise<boolean> {
    if (!store.dirty) return action()
    cancel()
    reason.value = nextReason
    open.value = true
    return new Promise<boolean>((resolve) => {
      pending = { action, resolve }
    })
  }

  async function saveAndContinue(): Promise<void> {
    if (!pending || !saveCurrent || saving.value) return
    saving.value = true
    try {
      if (await saveCurrent()) await executePending()
      else cancel()
    } finally {
      saving.value = false
    }
  }

  return {
    open,
    saving,
    reason,
    request,
    saveAndContinue,
    discardAndContinue: executePending,
    cancel,
    setSaveCurrent: (next) => { saveCurrent = next },
  }
}

let sharedGuard: UnsavedChangesGuard | undefined
let sharedStore: ReturnType<typeof useProjectStore> | undefined

export function useUnsavedChangesGuard(saveCurrent?: GuardedAction): UnsavedChangesGuard {
  const store = useProjectStore()
  if (!sharedGuard || sharedStore !== store) {
    sharedStore = store
    sharedGuard = createUnsavedChangesGuard(store, saveCurrent)
  } else if (saveCurrent) {
    sharedGuard.setSaveCurrent(saveCurrent)
  }
  return sharedGuard
}
