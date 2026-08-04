<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { latestReleaseNotes } from '@/content/release-notes'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const closeButton = ref<HTMLButtonElement | null>(null)
const activeTab = ref<'usage' | 'release' | 'project'>('usage')

function focusDialog(): void { nextTick(() => closeButton.value?.focus()) }
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.key !== 'Tab') return
  const root = event.currentTarget as HTMLElement
  const focusable = Array.from(root.querySelectorAll<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])'))
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

watch(() => props.open, (open) => { if (open) focusDialog() })
</script>

<template>
  <div v-if="open" class="dialog-backdrop" role="presentation" @click.self="emit('close')" @keydown="handleKeydown">
    <section class="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <header class="about-header">
        <BrandLogo />
        <div><h2 id="about-title">锚点像素工作台</h2><p>图片像素化与拼豆图工具</p></div>
        <button ref="closeButton" class="dialog-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
      </header>
      <nav class="about-tabs" aria-label="关于工具内容">
        <button class="about-tab" :class="{ active: activeTab === 'usage' }" type="button" @click="activeTab = 'usage'">使用方法</button>
        <button class="about-tab" :class="{ active: activeTab === 'release' }" type="button" @click="activeTab = 'release'">更新日志</button>
        <button class="about-tab" :class="{ active: activeTab === 'project' }" type="button" @click="activeTab = 'project'">项目与许可</button>
      </nav>
      <div class="about-content">
        <section v-if="activeTab === 'usage'" class="about-section">
          <h3>快速开始</h3>
          <ol><li>导入图片并选择图像范围；</li><li>选择像素化方式，生成并编辑结果；</li><li>检查拼豆 PDF 分页或 SVG 总览；</li><li>从对应工作区导出文件。</li></ol>
          <h3>常用操作</h3>
          <p><kbd>Ctrl / Command</kbd> + 滚轮缩放；</p>
          <p><kbd>Ctrl / Command</kbd> + <kbd>Z</kbd> 撤销。</p>
          <p>原图和像素结果可用空格加左键或中键平移；拼豆文档按视口中心缩放并通过普通滚动阅读；双击空白区域或点击“恢复视图”适应窗口；</p>

        </section>
        <section v-else-if="activeTab === 'release'" class="about-section"><h3>最近更新</h3><ul><li v-for="note in latestReleaseNotes" :key="note">{{ note }}</li></ul><a href="https://github.com/EachYoungX/pixel-anchor-studio/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer">查看完整更新日志</a></section>
        <section v-else class="about-section"><h3>项目与许可</h3><p>图片处理全部在当前浏览器中完成，不会上传到服务器。</p><a href="https://github.com/EachYoungX/pixel-anchor-studio" target="_blank" rel="noreferrer">打开 GitHub 项目</a><a href="https://github.com/EachYoungX/pixel-anchor-studio/blob/main/LICENSE" target="_blank" rel="noreferrer">查看 MIT License</a></section>
      </div>
      <footer class="about-footer"><a class="button button-primary" href="https://github.com/EachYoungX/pixel-anchor-studio" target="_blank" rel="noreferrer">打开 GitHub 项目</a></footer>
    </section>
  </div>
</template>

<style scoped>
.dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 20px; background: rgba(20, 24, 28, 0.35); }
.about-dialog { width: min(720px, calc(100vw - 40px)); height: min(720px, calc(100dvh - 48px)); display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; overflow: hidden; padding: 0; border: 1px solid var(--border); border-radius: 12px; background: #fff; }
.about-header { display: flex; align-items: center; gap: 12px; padding: 22px 24px 18px; border-bottom: 1px solid var(--border); }
.about-header h2 { font-size: 22px; }
.about-header p { font-size: 14px; }
.dialog-close { margin-left: auto; align-self: flex-start; border: 0; background: transparent; color: var(--muted); font-size: 28px; line-height: 1; }
.about-tabs { display: flex; gap: 4px; padding: 10px 24px 0; border-bottom: 1px solid var(--border); }
.about-tab { padding: 8px 10px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); font-size: 13px; }
.about-tab.active { border-bottom-color: var(--accent); color: var(--accent); font-weight: 650; }
.about-content { min-height: 0; overflow: auto; padding: 22px 24px; }
.about-section { display: grid; gap: 14px; font-size: 14px; }
.about-section h3 { font-size: 15px; }
.about-section p, .about-section li { font-size: 14px; line-height: 1.7; }
.about-section a { color: var(--accent); font-size: 13px; }
.about-section ol, .about-section ul { margin: 0; padding-left: 22px; }
kbd { padding: 2px 5px; border: 1px solid var(--border-strong); border-radius: 4px; background: var(--surface-muted); font-size: 12px; }
.about-footer { display: flex; justify-content: flex-end; padding: 14px 24px 18px; border-top: 1px solid var(--border); }
</style>
