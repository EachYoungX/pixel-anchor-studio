<script setup lang="ts">
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
</script>

<template>
  <aside>
    <header class="palette-header">
      <div>
        <h2>颜色与用量</h2>
        <p>{{ store.palette.length }} 种颜色</p>
      </div>
      <span v-if="store.result">{{ store.beadCount }} 个有色格 / {{ store.result.width * store.result.height }} 总格</span>
    </header>

    <div v-if="store.palette.length === 0" class="empty-state">
      生成结果后，此处显示色号、颜色值和数量统计。
    </div>

    <div v-else class="palette-body">
      <p class="palette-help">点击条目选择画笔颜色。可将任意颜色合并到当前颜色。</p>
      <ol class="palette-list">
        <li
          v-for="entry in store.palette"
          :key="entry.hex"
          class="palette-item"
          :class="{ selected: store.selectedColor === entry.hex }"
          @click="store.selectedColor = entry.hex"
        >
          <span
            class="swatch"
            :class="{ transparent: entry.rgba[3] === 0 }"
            :style="entry.rgba[3] === 0 ? undefined : { backgroundColor: entry.hex }"
          />
          <span class="palette-code">{{ entry.code }}</span>
          <span class="palette-value">
            <strong>{{ entry.hex }}</strong>
            <small>×{{ entry.count }}</small>
          </span>
          <button
            class="button button-small merge-button"
            type="button"
            :disabled="store.selectedColor === entry.hex"
            title="将该颜色替换为当前选中的颜色"
            @click.stop="store.mergeColor(entry.hex, store.selectedColor)"
          >
            合并
          </button>
        </li>
      </ol>
    </div>
  </aside>
</template>

<style scoped>
.palette-header {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}
.palette-header span { color: var(--muted); font-size: 11px; }
.palette-body { padding: 10px; }
.palette-help { padding: 2px 3px 10px; }
.palette-list { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.palette-item {
  display: grid;
  grid-template-columns: 28px 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-height: 42px;
  padding: 5px;
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
}
.palette-item:hover { background: #f5f6f7; }
.palette-item.selected { border-color: #aeb8c1; background: #eef2f5; }
.swatch { width: 28px; height: 28px; border: 1px solid #b9bec4; border-radius: 5px; }
.swatch.transparent {
  background-color: #ffffff;
  background-image: linear-gradient(45deg, #d7dadd 25%, transparent 25%), linear-gradient(-45deg, #d7dadd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d7dadd 75%), linear-gradient(-45deg, transparent 75%, #d7dadd 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0;
}
.palette-code { font-size: 12px; font-weight: 700; color: #343a40; }
.palette-value { min-width: 0; display: grid; gap: 2px; }
.palette-value strong { overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
.palette-value small { color: var(--muted); font-size: 10px; }
.merge-button { padding-inline: 6px; }
</style>
