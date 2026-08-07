<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { latestRelease } from '@/content/release-notes'
import licenseText from '../../LICENSE?raw'
import { getPlatformService } from '@/platform'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const closeButton = ref<HTMLButtonElement | null>(null)
const activeTab = ref<'usage' | 'release' | 'project'>('usage')

function focusDialog(): void { nextTick(() => closeButton.value?.focus()) }
async function openExternal(event: MouseEvent, url: string): Promise<void> {
  event.preventDefault()
  await (await getPlatformService()).openExternalUrl(url)
}
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

watch(() => props.open, (open) => {
  if (!open) return
  activeTab.value = 'usage'
  focusDialog()
})
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
        <button class="about-tab" :class="{ active: activeTab === 'usage' }" type="button" @click="activeTab = 'usage'">快速开始</button>
        <button class="about-tab" :class="{ active: activeTab === 'release' }" type="button" @click="activeTab = 'release'">更新日志</button>
        <button class="about-tab" :class="{ active: activeTab === 'project' }" type="button" @click="activeTab = 'project'">项目与许可</button>
      </nav>
      <div class="about-content">
        <section v-if="activeTab === 'usage'" class="about-section">
          <h3>快速开始</h3>
          <ol><li>点击右上角导入图片或者将图片直接拖拽到工作页面并选择图像裁剪范围</li><li>选择像素化方式以及采样与颜色处理方式，生成并编辑结果</li><li>检查拼豆 PDF 分页或 SVG 总览</li><li>从对应工作区导出文件</li></ol>
          <h3>常用操作</h3>
          <p>位于原图与网格和像素结果区域：</p>
          <p>缩放：<kbd>Ctrl / Command</kbd> + <kbd>滚轮</kbd></p>
          <p>平移：<kbd>空格/space</kbd> 加 <kbd>左键</kbd> 或 <kbd>中键</kbd></p>
          <p>全局：<kbd>Ctrl / Command</kbd> + <kbd>Z</kbd> 撤销</p>
          <p>拼豆文档按视口中心缩放并通过普通滚动阅读</p>
          <p>双击空白区域或点击“恢复视图”适应窗口</p>
          <div class="reopen-tip">
            <p>关闭窗口后，点击页面左上角的“锚点像素工作台”标题，即可重新打开本窗口</p>
          </div>
        </section>
        <section v-else-if="activeTab === 'release'" class="about-section">
          <h3>最近更新</h3>
          <template v-if="latestRelease">
            <p class="release-meta">v{{ latestRelease.version }}<span v-if="latestRelease.date"> · {{ latestRelease.date }}</span></p>
            <div v-for="section in latestRelease.sections" :key="section.title" class="release-section">
              <h4>{{ section.title }}</h4>
              <ul><li v-for="item in section.items" :key="item">{{ item }}</li></ul>
            </div>
          </template>
          <p v-else>暂无可显示的更新记录。</p>
          <a href="https://github.com/EachYoungX/pixel-anchor-studio/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer" @click="openExternal($event, 'https://github.com/EachYoungX/pixel-anchor-studio/blob/main/CHANGELOG.md')">查看完整更新日志</a>
        </section>
        <section v-else class="about-section project-license">
          <h3>项目声明</h3>
          <p>锚点像素工作台是一款在浏览器本地运行的图片像素化与拼豆文档工具。项目不要求注册账号，不提供云端存储，也不会主动将导入图片、像素结果或项目文件上传到服务器。</p>
          <h3>隐私说明</h3>
          <p>图片解码、像素处理、项目保存和文档导出均在当前浏览器中完成。除非用户自行下载或分享导出文件，工具不会主动传输这些内容。</p>
          <h3>使用与责任</h3>
          <p>用户应确保有权使用导入的图片，并自行确认生成结果的发布、商业使用与第三方素材许可。工具仅提供图像转换和文档生成能力，不对输入内容及其后续使用承担审查责任。</p>
          <p>项目按照开源许可证按现状提供，不保证适用于所有图片、浏览器、打印设备或拼豆品牌色板。重要项目应自行保存原图、项目文件和导出结果。</p>
          <h3>许可证全文</h3>
          <pre class="license-text">{{ licenseText }}</pre>
        </section>
      </div>
      <footer class="about-footer">
        <button class="button" type="button" @click="emit('close')">关闭</button>
        <a class="button button-primary" href="https://github.com/EachYoungX/pixel-anchor-studio" target="_blank" rel="noreferrer" @click="openExternal($event, 'https://github.com/EachYoungX/pixel-anchor-studio')">打开 GitHub 项目</a>
      </footer>
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
.about-section h4 { margin: 0; font-size: 14px; }
.about-section p, .about-section li { font-size: 14px; line-height: 1.7; }
.about-section a { color: var(--accent); font-size: 13px; }
.about-section ol, .about-section ul { margin: 0; padding-left: 22px; }
.quick-start-intro { color: var(--text); }
.reopen-tip { display: grid; gap: 8px; margin-top: 4px; padding: 14px; border: 1px solid #cbd5dd; border-radius: 8px; background: var(--accent-soft); }
.reopen-tip p { color: #35495a; }
kbd { padding: 2px 5px; border: 1px solid var(--border-strong); border-radius: 4px; background: var(--surface-muted); font-size: 12px; }
.release-meta { color: var(--text); font-weight: 650; }
.release-section { display: grid; gap: 8px; }
.project-license { align-content: start; }
.license-text { max-height: 260px; overflow: auto; margin: 0; padding: 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-muted); color: #343a40; font: 12px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; }
.about-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px 18px; border-top: 1px solid var(--border); }
.about-footer .button-primary { min-height: 38px; padding: 8px 16px; font-size: 14px; font-weight: 650; }
</style>
