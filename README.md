# 锚点像素工作台

一个在本地运行的图片像素化与拼豆图工具，同时提供网页版本与 Windows x64 桌面版本。

它可以处理风景、物品、动物、人像、二次元图片和 AI 生成的伪像素图。普通图片可以直接指定输出大小；需要保留局部细节时，可以用特征锚点确定像素尺度；已经具有像素块结构的图片，则可以使用伪像素对齐进行重新整理。

图片处理全部在当前设备中完成，不会上传到服务器。

## Windows 桌面版

v0.5.1 提供两种 Windows 10/11 x64 发行形式：

- **便携版**：完整解压后直接运行，应用设置、WebView 数据、缓存和恢复数据均位于便携目录的 `data` 文件夹；移动整个目录即可迁移；
- **安装版**：按当前用户安装，可修改安装位置和应用数据位置；默认数据目录为 `%LOCALAPPDATA%\PixelAnchorStudio\data`，开始菜单快捷方式默认创建，桌面快捷方式可按需勾选。

桌面版不需要 Node.js、npm、Rust、Vite、本地服务器或独立浏览器。它使用系统 Microsoft Edge WebView2 Runtime；系统缺少该组件时，程序会在创建窗口前说明并提供微软官方安装入口。WebView2 已安装时，图片处理、项目读写和全部导出功能均可断网使用。

桌面版通过系统文件对话框打开图片和项目，并保存项目、PNG、SVG、PDF 与 CSV。项目和导出文件不会默认保存到安装目录或内部数据目录。`Ctrl+I` 导入图片、`Ctrl+O` 打开项目、`Ctrl+S` 保存、`Ctrl+Shift+S` 另存为。

### SmartScreen 与校验

当前桌面测试版本尚未进行 Windows 代码签名，因此 Microsoft Defender SmartScreen 可能显示“Windows 已保护你的电脑”。请只从本项目官方 GitHub 仓库的 Actions Artifact 或 Release 下载，并核对随包提供的 `SHA256SUMS.txt`。确认来源和 SHA-256 完全一致后，点击“更多信息”，检查应用名称，再点击“仍要运行”。不要关闭 SmartScreen，也不要从第三方网站下载安装包。

PowerShell 校验示例：

```powershell
Get-FileHash .\PixelAnchorStudio-0.5.1-Setup.exe -Algorithm SHA256
Get-FileHash .\PixelAnchorStudio-0.5.1-Portable.zip -Algorithm SHA256
```

便携版删除整个解压目录时，也会删除该目录中的设置、缓存以及用户自行放入的项目或导出文件；删除前请先移动需要保留的文件。安装版卸载时默认勾选删除应用数据，但只删除经过所有权标记确认的内部数据；安装目录或自定义数据目录中的未知文件会保留并提示。

日常 Push 只运行检查和端到端测试，不生成桌面安装包。需要测试 Windows 安装版与便携版时，在 GitHub Actions 中手动运行 `Desktop Build`；其 Artifact 保留 14 天，不会自动发布到 Releases。

## 能做什么

- 裁剪图片并生成最大 `256 × 256` 的像素结果；
- 使用指定尺寸、特征锚定或伪像素对齐三种方式控制像素尺度；
- 减少颜色数量、合并相近颜色并清理少量杂色；
- 使用画笔、吸管、填充和透明工具修正结果；
- 以 1×、2×、4×、8×或自定义整数倍导出 PNG 像素图；
- 导出带行列号、色号和用量统计的拼豆 SVG、PDF 和 CSV；
- 在 PDF 分页和 SVG 总览之间切换，检查最终拼豆文档布局。

## 快速使用

1. 导入图片，选择完整原图、居中正方形或自由裁剪；
2. 选择一种像素化方式并生成预览；
3. 在像素结果中进行必要的颜色和局部修正，并按所需整数倍导出 PNG；
4. 打开拼豆图导出工作区，检查 PDF 分页或 SVG 总览；
5. 从顶部“项目”菜单保存或打开项目；从拼豆工作区导出 SVG、PDF 和 CSV。

原图和像素结果支持 `Ctrl / Command + 滚轮` 缩放、空格加左键或中键双轴平移、双击空白区域恢复视图；普通滚轮继续滚动中央页面。拼豆文档保持阅读型的普通滚动和中心缩放。

## 三种像素化方式

- **自定义尺寸**：指定输出长边，适合普通照片、插画和大多数图片；
- **特征锚定**：用方框标记眼睛、花蕊、窗户或徽章等参考部位，再指定它在结果中大约占几格；
- **伪像素对齐**：调整已有像素块、放大像素图或 AI 伪像素图的网格尺度与相位。

## 颜色处理

可以限制颜色数量、按用量或色环排序、合并相近颜色，并清理少量孤立杂色。像素编辑和拼豆导出共用右侧颜色与用量栏；拼豆导出页面中的颜色列表为只读状态。

## 拼豆图导出

拼豆页面提供两种文档预览：PDF 分页显示 A4 横向页面、页码和四边编号；SVG 总览显示完整图案和下方颜色图例。网页预览与对应导出文件使用同一套页面布局。

## 使用说明

- 暂无自动眼睛或人脸定位，需要手动设置特征锚点；
- 暂无 Perler、Hama、Artkal 等厂商拼豆色板；
- 大型施工图包含大量网格和文字，可能需要更多生成时间。
- 大尺寸原图保存为项目文件时可能需要较多内存和时间，重要项目请同时保留原图和导出结果。

## 本地运行

```bash
npm install
npm run dev
```

执行生产构建：

```bash
npm run build
```

Windows 桌面开发与发行构建：

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:webview2
npm run desktop:portable
npm run desktop:installer
npm run desktop:release
```

桌面发行构建需要 Node.js 22、Rust stable、MSVC x64 工具链和 NSIS。`desktop:webview2` 只从微软官方地址下载 Evergreen Bootstrapper，并按仓库锁定的 SHA-256 校验；普通网页构建不会下载该依赖。

性能基准：

```bash
npm run test:bench
```

## 更新日志

查看[更新日志](CHANGELOG.md)。

## 许可证

项目代码采用 MIT License。
