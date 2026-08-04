<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="open" class="dialog-backdrop" role="presentation" @click.self="emit('close')">
    <section class="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <button class="dialog-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
      <h2 id="about-title">关于锚点像素工作台</h2>
      <p>图片像素化与拼豆图工具，在当前浏览器本地完成处理。</p>
      <div class="about-links">
        <a href="https://github.com/EachYoungX/pixel-anchor-studio" target="_blank" rel="noreferrer">打开 GitHub 项目</a>
        <a href="https://github.com/EachYoungX/pixel-anchor-studio/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer">查看更新日志</a>
      </div>
      <p class="about-license">项目代码采用 MIT License。</p>
    </section>
  </div>
</template>

<style scoped>
.dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 20px; background: rgba(20, 24, 28, 0.35); }
.about-dialog { position: relative; width: min(420px, 100%); display: grid; gap: 14px; padding: 24px; border: 1px solid var(--border); border-radius: var(--radius); background: #fff; box-shadow: 0 18px 60px rgba(20, 24, 28, 0.2); }
.dialog-close { position: absolute; top: 8px; right: 10px; border: 0; background: transparent; color: var(--muted); font-size: 24px; line-height: 1; }
.about-links { display: grid; gap: 8px; }
.about-links a { color: var(--accent); font-size: 13px; }
.about-license { font-size: 11px; }
</style>
