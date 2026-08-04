import { onBeforeUnmount, onMounted } from 'vue'
import { useProjectStore } from '@/stores/project'

export function useGlobalShortcuts(): void {
  const store = useProjectStore()

  function handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null
    if (target?.isContentEditable || (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))) return
    if (!event.ctrlKey && !event.metaKey) return

    const key = event.key.toLowerCase()
    if (key === 'z' && event.shiftKey) {
      event.preventDefault()
      store.redo()
    } else if (key === 'z') {
      event.preventDefault()
      store.undo()
    } else if (key === 'y') {
      event.preventDefault()
      store.redo()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
}
