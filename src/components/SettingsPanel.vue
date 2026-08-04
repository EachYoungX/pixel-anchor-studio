<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
const snapHelp = computed(() => {
  if (store.scale.snapMode === 'source-pixel') return '框体按原图的单个像素移动或调整。适合照片、插画和需要精细定位的裁剪或特征框选。'
  if (store.scale.snapMode === 'target-cell') return '框体按结果中的一个像素格移动。适合规则色块、放大的像素图或需要整格对齐的范围。'
  return '不进行整数吸附，允许更细的自由调整。适合高倍率观察或网格相位微调。'
})

async function generate(): Promise<void> {
  try {
    await store.process()
  } catch {
    // Status text is already set by the store.
  }
}
</script>

<template>
  <aside>
    <section class="settings-section">
      <div class="section-title">
        <h2>一、图像范围</h2>
        <span>{{ Math.round(store.effectiveCrop.width) }} × {{ Math.round(store.effectiveCrop.height) }}</span>
      </div>
      <div class="segmented">
        <button class="button button-small" :class="{ 'button-active': store.cropSettings.mode === 'custom' }" type="button" :disabled="!store.source" @click="store.useCustomCrop">自由裁剪</button>
        <button class="button button-small" :class="{ 'button-active': store.cropSettings.mode === 'full' }" type="button" :disabled="!store.source" @click="store.useFullCrop">完整原图</button>
        <button class="button button-small" :class="{ 'button-active': store.cropSettings.mode === 'center-square' }" type="button" :disabled="!store.source" @click="store.useCenterSquareCrop">居中正方形</button>
      </div>
      <p class="help">选择原图中需要参与像素转换的内容。可以保留完整图片、快速截取中央正方形，也可以使用自由裁剪自行调整范围。</p>
      <p class="help">{{ store.cropSettings.mode === 'custom' ? '拖动框体可移动范围，拖动四角可调整大小。切换到其他预设不会删除已经设置的自由裁剪范围。' : store.cropSettings.mode === 'full' ? '使用整张图片进行转换，不需要调整裁剪框。' : '使用图片中央能够容纳的最大正方形区域。' }}</p>
    </section>

    <section class="settings-section">
      <div class="section-title">
        <h2>二、像素化方式</h2>
        <span>{{ store.outputDimensions.width }} × {{ store.outputDimensions.height }}</span>
      </div>
      <div class="segmented mode-tabs">
        <button
          class="button button-small"
          :class="{ 'button-active': store.scale.mode === 'direct' }"
          type="button"
          @click="store.setScaleMode('direct')"
        >自定义尺寸</button>
        <button
          class="button button-small"
          :class="{ 'button-active': store.scale.mode === 'anchor' }"
          type="button"
          @click="store.setScaleMode('anchor')"
        >特征锚定</button>
        <button
          class="button button-small"
          :class="{ 'button-active': store.scale.mode === 'pseudo' }"
          type="button"
          @click="store.setScaleMode('pseudo')"
        >伪像素对齐</button>
      </div>

      <template v-if="store.scale.mode === 'direct'">
        <div class="field">
          <label for="direct-value">长边像素数</label>
          <div class="range-row">
            <input id="direct-value" v-model.number="store.scale.directLongSide" class="range" type="range" min="8" max="256" step="1" />
            <input v-model.number="store.scale.directLongSide" class="input" type="number" min="1" max="256" />
          </div>
        </div>
        <p class="help">锁定原图比例，短边会依据当前裁剪比例自动计算，不进行非等比拉伸。</p>
      </template>

      <template v-else-if="store.scale.mode === 'anchor'">
        <button class="button button-small" :class="{ 'button-active': store.editTarget === 'anchor' }" type="button" :disabled="!store.source" @click="store.editTarget = 'anchor'">编辑特征锚点</button>
        <div class="field">
          <span class="field-label">参考部位在结果中的大小</span>
          <div class="anchor-options">
            <button
              v-for="value in 5"
              :key="value"
              class="button button-small"
              :class="{ 'button-active': store.scale.anchorCells === value }"
              type="button"
              @click="store.scale.anchorCells = value"
            >
              {{ value }} × {{ value }}
            </button>
          </div>
        </div>
        <p class="help">用方框套住一个希望保留的关键部位，例如一只眼睛、花蕊、窗户或徽章，再选择它在结果中大约占几格。格数越大，保留的细节越多；格数越小，像素感越强。方框只用于确定像素大小，不会改变物体形状。</p>
        <p class="help">当前为 {{ store.scale.anchorCells }} × {{ store.scale.anchorCells }}：参考部位在结果中大约占 {{ store.scale.anchorCells }} 格宽、{{ store.scale.anchorCells }} 格高。</p>
      </template>

      <template v-else>
        <div class="field">
          <label for="pseudo-size">每格覆盖的原图像素</label>
          <div class="range-row">
            <input id="pseudo-size" v-model.number="store.scale.pseudoCellSize" class="range" type="range" min="1" max="64" step="0.25" />
            <input v-model.number="store.scale.pseudoCellSize" class="input" type="number" min="0.25" max="128" step="0.25" />
          </div>
        </div>
        <p class="help">用于AI伪像素图、被缩放或压缩的像素图。调整尺度后，再使用下方网格偏移对齐原有色块。</p>
      </template>

      <div class="field">
        <span class="field-label">网格相位偏移</span>
        <label class="offset-line">
          <span>水平</span>
          <input v-model.number="store.scale.offsetX" class="range" type="range" min="-0.5" max="0.5" step="0.01" />
          <input v-model.number="store.scale.offsetX" class="input offset-input" type="number" min="-0.5" max="0.5" step="0.01" inputmode="decimal" />
        </label>
        <label class="offset-line">
          <span>垂直</span>
          <input v-model.number="store.scale.offsetY" class="range" type="range" min="-0.5" max="0.5" step="0.01" />
          <input v-model.number="store.scale.offsetY" class="input offset-input" type="number" min="-0.5" max="0.5" step="0.01" inputmode="decimal" />
        </label>
        <button class="button button-small" type="button" @click="store.resetGridPhase">偏移归零</button>
      </div>
      <div class="field"><label for="snap-mode">框体吸附</label><select id="snap-mode" v-model="store.scale.snapMode" class="select"><option value="source-pixel">原图像素（每次 1 px）</option><option value="target-cell">输出网格（每次 1 格）</option><option value="off">连续移动</option></select><p class="help">{{ snapHelp }}</p><p v-if="store.scale.mode === 'direct'" class="help">指定尺寸：推荐“原图像素”。</p><p v-else-if="store.scale.mode === 'anchor'" class="help">特征锚定：推荐“原图像素”。选择输出网格时，只影响锚点移动；调整大小仍保持精度。</p><p v-else class="help">伪像素对齐：推荐“输出网格”。</p></div>
    </section>

    <section class="settings-section">
      <div class="section-title"><h2>三、采样与颜色处理</h2></div>
      <div class="field">
          <label for="sampling">单元格采样</label>
        <select id="sampling" v-model="store.processing.sampling" class="select">
          <option value="average">区域平均</option>
          <option value="median">区域中位数</option>
          <option value="dominant">主色块</option>
          <option value="nearest">中心取样</option>
        </select>
      </div>
      <p class="help sampling-help">{{ store.processing.sampling === 'median' ? '抑制少量亮点和杂色，适合人像、动物和通用图片。' : store.processing.sampling === 'average' ? '混合整格颜色，适合渐变和柔和风景。' : store.processing.sampling === 'dominant' ? '选择格内占比最高的主色块，适合平涂图和伪像素图。' : '只读取格子中心，适合网格已对齐的建筑和线稿。' }}</p>
      <label class="checkbox-row">
        <span>限制最大颜色数</span>
        <input v-model="store.processing.quantize" type="checkbox" />
      </label>
      <div v-if="store.processing.quantize" class="field">
        <label for="max-colors">最大颜色数</label>
        <div class="range-row">
          <input id="max-colors" v-model.number="store.processing.maxColors" class="range" type="range" min="2" max="128" step="1" />
          <input v-model.number="store.processing.maxColors" class="input" type="number" min="2" max="256" />
        </div>
      </div>
      <div class="field">
        <label for="cleanup">碎色清理</label>
        <select id="cleanup" v-model="store.processing.cleanup" class="select">
          <option value="off">关闭</option>
          <option value="light">轻度：清理单格区域</option>
          <option value="medium">中度：清理两格以内区域</option>
          <option value="strong">强度：清理四格以内区域</option>
        </select>
      </div>
      <p class="help">碎色清理会删除面积很小的孤立色块，并替换为周边颜色；可能同时删除高光、首饰或细线等真实细节，默认建议关闭。</p>
      <label class="checkbox-row">
        <span>保留透明区域</span>
        <input v-model="store.processing.preserveAlpha" type="checkbox" />
      </label>
    </section>

    <section class="generate-area">
      <button class="button button-primary generate-button" type="button" :disabled="!store.canProcess || store.isProcessing" @click="generate">
        {{ store.isProcessing ? '正在生成' : '生成预览' }}
      </button>
    </section>
  </aside>
</template>

<style scoped>
.settings-section { display: grid; gap: 12px; padding: 14px; border-bottom: 1px solid var(--border); }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.section-title span { color: var(--muted); font-size: 12px; }
.mode-tabs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.mode-tabs .button { min-width: 0; padding-inline: 4px; white-space: nowrap; }
.anchor-options { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
.anchor-options .button { padding-inline: 3px; }
.offset-line { display: grid; grid-template-columns: 42px minmax(72px, 1fr) 76px; align-items: center; gap: 8px; color: #4b5158; font-size: 12px; }
.offset-input { min-width: 76px; padding-inline: 6px 4px; text-align: right; font-variant-numeric: tabular-nums; }
.offset-line output { text-align: right; font-variant-numeric: tabular-nums; }
.two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.generate-area { padding: 14px; position: sticky; bottom: 0; background: #ffffff; border-top: 1px solid var(--border); }
.generate-button { width: 100%; }
</style>
