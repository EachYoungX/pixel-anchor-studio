<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { sanitizeFilename } from '@/core/export/download'
import { exportPng } from '@/core/export/png'
import { isPngExportSizeAllowed, MAX_PNG_EDGE, MAX_PNG_SCALE, normalizePngScale, pngExportDimensions } from '@/core/export/png-scale'
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
const open = ref(false)
const preset = ref<'1' | '2' | '4' | '8' | 'custom'>('8')
const customScale = ref(8)
const exporting = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)

const scale = computed(() => preset.value === 'custom'
  ? normalizePngScale(customScale.value)
  : Number(preset.value))
const customScaleAllowed = computed(() => preset.value !== 'custom'
  || (Number.isInteger(Number(customScale.value)) && Number(customScale.value) >= 1 && Number(customScale.value) <= MAX_PNG_SCALE))
const finalDimensions = computed(() => pngExportDimensions(store.result?.width ?? 0, store.result?.height ?? 0, scale.value))
const finalWidth = computed(() => finalDimensions.value.width)
const finalHeight = computed(() => finalDimensions.value.height)
const sizeAllowed = computed(() => customScaleAllowed.value && store.result
  ? isPngExportSizeAllowed(store.result.width, store.result.height, scale.value)
  : false)
const validationMessage = computed(() => !customScaleAllowed.value
  ? `请输入 1–${MAX_PNG_SCALE} 之间的整数倍。`
  : `导出图片长边不能超过 ${MAX_PNG_EDGE} 像素，请降低放大倍数。`)
const filename = computed(() => {
  const base = sanitizeFilename(store.source?.name ?? 'pixel-art')
  const result = store.result
  return result ? `${base}-${result.width}x${result.height}-${scale.value}x.png` : `${base}.png`
})

function show(): void {
  if (!store.result) return
  open.value = true
}

function close(): void {
  open.value = false
  nextTick(() => trigger.value?.focus())
}

async function save(): Promise<void> {
  if (!store.result || exporting.value || !sizeAllowed.value) return
  exporting.value = true
  try {
    if (await exportPng(store.result, filename.value, scale.value)) {
      store.status = `PNG 已导出：${finalWidth.value} × ${finalHeight.value}`
      close()
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'PNG 导出失败')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <button ref="trigger" class="button button-small" type="button" :disabled="!store.result" @click="show">导出PNG</button>
  <Teleport to="body">
    <div v-if="open" class="pixel-export-backdrop" role="presentation">
      <section class="pixel-export-dialog" role="dialog" aria-modal="true" aria-labelledby="pixel-export-title">
        <header class="pixel-export-header">
          <div><h2 id="pixel-export-title">导出像素结果 PNG</h2><p>使用最近邻整数倍放大，保留透明通道。</p></div>
          <button class="dialog-close" type="button" aria-label="关闭导出窗口" @click="close">×</button>
        </header>
        <div class="pixel-export-body">
          <label class="field">
            <span class="field-label">放大倍数</span>
            <select v-model="preset" aria-label="PNG放大倍数">
              <option value="1">1× 原尺寸</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
              <option value="8">8×</option>
              <option value="custom">自定义</option>
            </select>
          </label>
          <label v-if="preset === 'custom'" class="field">
            <span class="field-label">自定义整数倍（1–{{ MAX_PNG_SCALE }}）</span>
            <input v-model.number="customScale" aria-label="自定义PNG倍数" type="number" min="1" :max="MAX_PNG_SCALE" step="1" />
          </label>
          <div class="export-summary"><span>最终尺寸</span><strong>{{ finalWidth }} × {{ finalHeight }}</strong></div>
          <p v-if="!sizeAllowed" class="export-limit" role="alert">{{ validationMessage }}</p>
          <div class="export-summary export-filename"><span>文件名</span><code>{{ filename }}</code></div>
          <div class="export-summary"><span>保存位置</span><strong>导出时选择</strong></div>
        </div>
        <footer class="pixel-export-footer">
          <button class="button" type="button" @click="close">取消</button>
          <button class="button button-primary" type="button" :disabled="exporting || !sizeAllowed" @click="save">{{ exporting ? '正在导出…' : '导出PNG' }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.pixel-export-backdrop { position: fixed; inset: 0; z-index: 24; display: grid; place-items: center; padding: 20px; background: rgba(20, 24, 28, 0.35); }
.pixel-export-dialog { width: min(440px, calc(100vw - 40px)); overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: #fff; box-shadow: 0 18px 48px rgba(20, 24, 28, 0.18); }
.pixel-export-header { display: flex; align-items: flex-start; gap: 16px; padding: 20px 22px 16px; border-bottom: 1px solid var(--border); }
.pixel-export-header h2 { font-size: 18px; }
.pixel-export-header p { margin-top: 5px; }
.dialog-close { margin-left: auto; border: 0; background: transparent; color: var(--muted); font-size: 26px; line-height: 1; }
.pixel-export-body { display: grid; gap: 16px; padding: 20px 22px; }
.export-summary { display: flex; justify-content: space-between; gap: 16px; padding: 11px 12px; border-radius: 7px; background: var(--surface-muted); color: var(--text-muted); font-size: 13px; }
.export-summary strong { color: var(--text); }
.export-limit { margin: -6px 2px 0; color: var(--danger); font-size: 12px; }
.export-filename { align-items: flex-start; flex-direction: column; }
.export-filename code { max-width: 100%; overflow-wrap: anywhere; color: var(--text); }
.pixel-export-footer { display: flex; justify-content: flex-end; gap: 9px; padding: 14px 22px 18px; border-top: 1px solid var(--border); }
</style>
