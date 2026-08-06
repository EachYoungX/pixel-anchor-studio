<script setup lang="ts">
import { SUPPORTED_IMAGE_TYPES_TEXT } from '@/core/import/drop-files'

defineProps<{ active: boolean }>()
</script>

<template>
  <Transition name="drop-overlay">
    <div v-if="active" class="drop-import-overlay" role="status" aria-live="polite" aria-label="拖放图片导入">
      <div class="drop-import-prompt">
        <svg class="drop-import-icon" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M15 41v7a5 5 0 0 0 5 5h24a5 5 0 0 0 5-5v-7M32 11v30m0-30L21 22m11-11 11 11" />
        </svg>
        <strong>图片拖放到此处即可导入</strong>
        <span>支持 {{ SUPPORTED_IMAGE_TYPES_TEXT }} · 文件仅在本地处理</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drop-import-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(245, 247, 249, 0.72);
  backdrop-filter: blur(5px);
  pointer-events: none;
}
.drop-import-prompt {
  display: grid;
  justify-items: center;
  gap: 11px;
  max-width: min(620px, 90vw);
  color: var(--text);
  text-align: center;
}
.drop-import-icon { width: 52px; height: 52px; margin-bottom: 3px; fill: none; stroke: var(--accent); stroke-width: 3.25; stroke-linecap: round; stroke-linejoin: round; }
.drop-import-prompt strong { font-size: clamp(20px, 2.2vw, 26px); font-weight: 650; line-height: 1.3; letter-spacing: 0.01em; }
.drop-import-prompt span { color: var(--muted); font-size: 12px; line-height: 1.6; }
.drop-overlay-enter-active, .drop-overlay-leave-active { transition: opacity 120ms ease; }
.drop-overlay-enter-from, .drop-overlay-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .drop-overlay-enter-active, .drop-overlay-leave-active { transition: none; }
}
</style>
