<script setup lang="ts">
import { computed } from 'vue'
import type { UnsavedChangesReason } from '@/composables/useUnsavedChangesGuard'

const props = defineProps<{ open: boolean; saving: boolean; reason: UnsavedChangesReason }>()
defineEmits<{ save: []; discard: []; cancel: [] }>()

const detail = computed(() => ({
  close: '退出后这些修改将无法恢复。',
  'import-image': '导入新图片将替换当前工作内容。',
  'open-project': '打开其他项目将替换当前工作内容。',
  clear: '清空后这些修改将无法恢复。',
})[props.reason])
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="unsaved-backdrop" role="presentation">
      <section class="unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
        <header><h2 id="unsaved-title">保存当前修改？</h2></header>
        <p>当前内容包含尚未保存的修改。<br />{{ detail }}</p>
        <footer>
          <button class="button" type="button" :disabled="saving" @click="$emit('cancel')">取消</button>
          <button class="button button-danger" type="button" :disabled="saving" @click="$emit('discard')">不保存</button>
          <button class="button button-primary" type="button" :disabled="saving" @click="$emit('save')">{{ saving ? '正在保存…' : '保存' }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.unsaved-backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 20px; background: rgba(20, 24, 28, 0.42); }
.unsaved-dialog { width: min(480px, calc(100vw - 40px)); display: grid; gap: 16px; padding: 22px; border: 1px solid var(--border); border-radius: 11px; background: #fff; box-shadow: 0 20px 56px rgba(20, 24, 28, 0.22); }
.unsaved-dialog h2 { font-size: 18px; }
.unsaved-dialog footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
</style>
