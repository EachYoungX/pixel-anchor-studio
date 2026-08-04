<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { rgbaToHex } from '@/core/color'
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
const canvas = ref<HTMLCanvasElement | null>(null)

function draw(): void {
  const element = canvas.value
  const result = store.result
  if (!element || !result) return
  const cell = Math.max(8, Math.min(28, Math.floor(680 / Math.max(result.width, result.height))))
  element.width = result.width * cell
  element.height = result.height * cell
  const context = element.getContext('2d')
  if (!context) return
  context.fillStyle = '#fff'
  context.fillRect(0, 0, element.width, element.height)
  const codes = new Map(store.palette.map((entry) => [entry.hex, entry.code]))
  context.font = `${Math.max(7, Math.floor(cell * 0.38))}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (let y = 0; y < result.height; y += 1) for (let x = 0; x < result.width; x += 1) {
    const offset = (y * result.width + x) * 4
    const rgba: [number, number, number, number] = [result.data[offset], result.data[offset + 1], result.data[offset + 2], result.data[offset + 3]]
    const hex = rgbaToHex(...rgba)
    context.fillStyle = rgba[3] === 0 ? '#fff' : hex
    context.fillRect(x * cell, y * cell, cell, cell)
    context.strokeStyle = '#b8bdc5'
    context.strokeRect(x * cell + 0.5, y * cell + 0.5, cell, cell)
    const code = codes.get(hex)
    if (code && cell >= 14) {
      const luminance = 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2]
      context.fillStyle = luminance > 145 ? '#111' : '#fff'
      context.fillText(code, x * cell + cell / 2, y * cell + cell / 2)
    }
  }
  if (cell >= 12) {
    context.strokeStyle = '#8b4a43'
    context.setLineDash([5, 3])
    for (let x = store.bead.pageColumns; x < result.width; x += store.bead.pageColumns) {
      context.beginPath(); context.moveTo(x * cell, 0); context.lineTo(x * cell, element.height); context.stroke()
    }
    for (let y = store.bead.pageRows; y < result.height; y += store.bead.pageRows) {
      context.beginPath(); context.moveTo(0, y * cell); context.lineTo(element.width, y * cell); context.stroke()
    }
    context.setLineDash([])
  }
}

watch(() => [store.result, store.palette, store.bead.pageColumns, store.bead.pageRows], () => nextTick(draw), { deep: false })
onMounted(draw)
</script>

<template>
  <div class="bead-preview-viewport">
    <canvas ref="canvas" class="bead-canvas" />
  </div>
</template>

<style scoped>
.bead-preview-viewport { max-height: 620px; overflow: auto; padding: 14px; background: #e9ebee; border: 1px solid var(--border); border-radius: var(--radius); }
.bead-canvas { display: block; margin: auto; image-rendering: pixelated; }
</style>
