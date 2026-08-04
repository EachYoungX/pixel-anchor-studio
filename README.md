# 像素锚点 Pixel Anchor Studio

一个完全在浏览器本地运行的通用图像像素化与拼豆施工图工具。它支持风景、自然物品、猫狗、人像、二次元图像和AI伪像素图。人像眼部锚定是高级尺度工具，不是普通转换的前置条件。

## 当前版本

当前压缩包为 `0.1.0` 可运行MVP，已包含：

- PNG、JPEG、WebP等浏览器支持图片的本地导入；
- 原图浮点坐标裁剪框，可拖动和四角缩放；
- 输出最大不超过 `256 × 256`；
- 指定长边、宽度或高度的等比缩放；
- 通用特征锚点，以及适合单眼的 `1×1` 至 `5×5` 占格尺度；
- 伪像素重整模式，支持原图像素/逻辑格尺度和水平、垂直网格相位偏移；
- 区域平均、区域中位数、多数色、中心最近邻四种采样；
- 内置Median Cut颜色归一化；
- 小连通区域碎色清理；
- 画笔、吸管、填充、透明、撤销和重做；
- PNG原尺寸与整数倍导出；
- 拼豆SVG、分页PDF、颜色CSV导出；
- 四边行列号、格内色号、色号图例与数量统计；
- 本地项目JSON保存与重新打开；
- 图像处理在Web Worker中执行，不上传图片。

## 运行环境

Vite 8要求较新的Node.js。建议使用：

- Node.js `22.12` 或更高版本；
- npm `10` 或更高版本；
- 最新版Chrome、Edge或Firefox。

## 启动

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

测试：

```bash
npm run test
```

## 使用流程

1. 点击“导入图片”。
2. 在原图画布中拖动裁剪框，拖动四角调整范围。
3. 选择尺度模式：
   - **直接尺寸**：适合风景、物品、动物和普通转换；
   - **特征锚定**：框住眼睛、花蕊、窗户等参考区域，并规定它占几格；
   - **伪像素重整**：适合AI生成或被缩放压缩的伪像素图。
4. 调整网格相位，使眼睛、轮廓或原有色块与网格对齐。
5. 选择采样方式、最大颜色数和碎色清理强度。
6. 点击“生成预览”。
7. 在像素结果中进行必要的手工修正。
8. 导出PNG、拼豆SVG/PDF或颜色CSV。

## 三种尺度模式

### 直接尺寸

指定目标宽度、高度或长边，另一边按裁剪比例自动计算。项目不进行非等比拉伸。

### 特征锚定

锚点框在原图坐标中保存。假设锚点边长为 `L`，用户规定其占 `n` 格，则每个逻辑像素覆盖约 `L / n` 个源图像素，并据此推导整个裁剪区域的输出宽高。

锚点框不会改变图像形状，它只负责尺度标定。

### 伪像素重整

用户直接调整每个逻辑格覆盖的源图像素数，并通过 `-0.5` 至 `+0.5` 格的相位偏移使采样网格与原有色块对齐。推荐使用“多数色”采样并关闭抖动。

## 拼豆导出限制

默认拼豆色数上限为64。结果颜色超过上限时，PNG仍可导出，但SVG和PDF施工图会被禁用。请启用颜色归一化、降低最大颜色数并重新生成。

PDF按设置中的每页行列数自动分页。每一页均包含四边行列号，末尾追加色号图例。

## 目录结构

```text
src/
  components/             页面组件
  core/
    export/               PNG、SVG、PDF、CSV、项目文件
    image/                图片载入与ImageData转换
    processing/           采样、量化、连通区域清理
  stores/                 Pinia项目状态与编辑历史
  types/                  数据模型
  workers/                Web Worker入口
docs/
  INTERNAL_DEVELOPMENT_PLAN.md
  ARCHITECTURE.md
  ALGORITHM_NOTES.md
  OPEN_SOURCE_NOTICES.md
CHANGELOG.md               对外版本日志
```

## 已知限制

- 当前锚点框为通用手动方框，不包含人脸检测或自动眼部定位；
- 伪像素网格尺度需要手动调整，自动周期估计安排在后续版本；
- 当前量化采用项目内置Median Cut，暂未提供厂商拼豆色板；
- 像素编辑器是最终修正工具，不是完整的图层式像素绘画软件；
- 项目JSON包含原图Data URL，文件体积可能接近或高于原图体积；
- 大型 `256 × 256` 拼豆PDF会产生大量矢量单元和分页，生成时间取决于浏览器性能。

## 文档

- 内部开发计划：[`docs/INTERNAL_DEVELOPMENT_PLAN.md`](docs/INTERNAL_DEVELOPMENT_PLAN.md)
- 架构说明：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 算法说明：[`docs/ALGORITHM_NOTES.md`](docs/ALGORITHM_NOTES.md)
- 开源依赖：[`docs/OPEN_SOURCE_NOTICES.md`](docs/OPEN_SOURCE_NOTICES.md)
- 对外版本日志：[`CHANGELOG.md`](CHANGELOG.md)

## 许可证

项目代码采用MIT License。第三方依赖的许可证见 `docs/OPEN_SOURCE_NOTICES.md`。
