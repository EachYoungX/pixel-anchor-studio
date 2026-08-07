# Pixel Anchor Studio 打包与发布指南

---

# 一、项目的三个流程

项目现在有三条不同的链路：

```text
日常开发 Push
      ↓
      CI

需要桌面测试
      ↓
手动 Desktop Build
      ↓
   Artifact

正式版本
      ↓
正式 Release 流程
```

当前仓库已经实现前两条。

正式Tag自动创建Draft Release的第三条链路，计划在v1.0.0正式发布前加入。

---

# 二、CI什么时候运行

当前：

```text
.github/workflows/ci.yml
```

触发条件：

```yaml
on:
  push:
  pull_request:
```

因此：

> CI会在普通Push和Pull Request事件中自动运行。

当前CI包含：

```text
check
e2e
```

其中：

```text
check
→ npm run check
→ typecheck + unit test + Web production build
```

以及：

```text
e2e
→ Playwright
```

CI内部虽然会临时生成Web构建结果，但这些只存在于GitHub Runner的临时环境中。

CI不会生成Windows Setup.exe和Portable.zip，也不会上传桌面发行Artifact以及创建GitHub Release。

---

# 三、什么时候Push

通常以下工作只需要：

```text
Commit
→ Push
→ 等CI
```

例如：

- Vue界面修改；
- 样式修改；
- Web逻辑修改；
- 像素算法修复；
- 单元测试；
- README；
- CHANGELOG；
- 普通重构；
- 不涉及Windows原生行为的Bug。

执行操作：

```bash
git add .
git commit -m "..."
git push
```

确认`check`以及`e2e`通过即可
```

正常Push之后不应自动出现新的Desktop Build运行。

---

# 五、什么时候需要手动桌面打包

以下修改应手动运行Desktop Build：

- 修改`src-tauri`；
- 修改Rust代码；
- 修改WebView2检测；
- 修改原生拖放；
- 修改安装版数据目录；
- 修改NSIS；
- 修改卸载逻辑；
- 修改便携版构建脚本；
- 修改Windows原生文件选择与保存；
- 修改窗口状态；
- 修改单实例；
- 修改桌面快捷键；
- 修改Tauri权限；
- 修改安装文件清单；
- 准备阶段性Windows测试；
- 准备正式发布候选版本。

普通前端小修改不需要每次生成Windows包。

---

# 六、如何手动生成测试包

当前工作流：

```text
.github/workflows/desktop-build.yml
```

只有：

```yaml
on:
  workflow_dispatch:
```

因此只能手动触发。

## GitHub网页步骤

1. 打开项目GitHub仓库；
2. 点击顶部`Actions`；
3. 左侧选择`Desktop Build`；
4. 点击右侧`Run workflow`；
5. 在Branch下拉框选择要构建的分支，通常为：

```text
main
```

6. 点击绿色`Run workflow`；
7. 等待新的运行记录出现；
8. 打开运行记录；
9. 等待：

```text
windows-x64
```

变为绿色；
10. 滚动到页面底部的`Artifacts`；
11. 下载：

```text
PixelAnchorStudio-<commit-sha>-windows-x64
```

Artifact解压后应包含：

```text
PixelAnchorStudio-0.5.1-Portable.zip
PixelAnchorStudio-0.5.1-Setup.exe
SHA256SUMS.txt
```

当前Artifact保留14天。

---

# 七、手动Build实际执行什么

Desktop Build使用：

```text
windows-latest
```

GitHub托管Runner。

依次执行：

```text
Node.js 22
Rust stable
x86_64-pc-windows-msvc
npm ci
npm run check
Playwright E2E
WebView2 Bootstrapper下载与校验
便携版构建
NSIS安装版构建
SHA256SUMS生成
Artifact上传
```

Windows发行包交给GitHub Runner。

---

# 十一、校验SHA-256

下载Artifact后读取：

```text
SHA256SUMS.txt
```

PowerShell：

```powershell
Get-FileHash .\PixelAnchorStudio-0.5.1-Setup.exe -Algorithm SHA256
Get-FileHash .\PixelAnchorStudio-0.5.1-Portable.zip -Algorithm SHA256
```

结果必须和SHA文件一致。

---

# 十二、测试包是否放到Releases

通常不需要,它不是面向普通用户的长期下载且14天后自动过期。因此测试包一般只下载自己测试即可。

---

## 5. 自动重新构建正式包

未来的Release Workflow应从版本对应Commit重新构建。完成后自动建立Draft Release

---

## 6. 审核Draft

GitHub：

```text
Releases
→ Draft
```

检查：

- Tag；
- Commit；
-版本号；
-Setup；
-Portable；
-SHA；
-Release Notes。

---

## 7. 下载Draft资产做最终抽检

至少再次确认：

```text
安装版能启动
便携版能启动
版本号为1.0.0
SHA一致
```

---

---

# 十九、Beta和RC怎么处理

如果需要公开测试可建立GitHub Pre-release,但如果只是开发者自己测试,Desktop Build Artifact已经足够，不需要污染Releases列表。

---

# 二十、推荐日常工作流

## 日常开发

```text
开发
↓
Commit
↓
Push
↓
CI
```

---

## 阶段性桌面测试

```text
阶段开发完成
↓
Push
↓
CI通过
↓
手动Desktop Build
↓
下载Artifact
↓
Windows测试
```

---

## 正式发布

```text
最终代码
↓
Push
↓
CI
↓
手动Desktop Build候选验证
↓
Tag
↓
Release Workflow重新构建
↓
Draft Release
↓
最终抽检
↓
Publish
```

---

# 二十一、当前v0.5.1要验证什么

现在最重要的验证是：

## Push

正常Push一个提交。

Actions应自动出现：

```text
CI
```

不应自动出现：

```text
Desktop Build
```

---

## 手动Build

随后：

```text
Actions
→ Desktop Build
→ Run workflow
```

应出现：

```text
windows-x64
```

并最终生成Artifact。

Releases页面不应新增任何内容。

这说明v0.5.1工作流拆分正确。

---

# 二十二、常见错误

## 每次Push都手动打桌面包

没必要。

只有需要Windows真实验证时才打。

## 把Artifact当Release

Artifact是开发测试产物；Release是公开发行记录。

## 给测试Artifact改名后直接当正式包

不要。

正式包必须从最终Tag重新构建。

## 正式Tag之后继续移动Tag

不要重写正式Tag。

发现问题应：

```text
修复
→ v1.0.1
```

## 忘记验证SHA

正式发布前Setup和Portable都必须能在`SHA256SUMS.txt`中找到对应校验值。

---

# 二十三、工作流速查表

| 场景 | CI | 手动 Desktop Build | Artifact | Release |
|---|---:|---:|---:|---:|
| 日常开发Push | 自动 | 否 | 否 | 否 |
| 普通Bug修复 | 自动 | 通常否 | 否 | 否 |
| 桌面功能修改 | 自动 | 是 | 是 | 否 |
| 安装器修改 | 自动 | 是 | 是 | 否 |
| 阶段性Windows测试 | 自动 | 是 | 是 | 否 |
| 内部Release Candidate | 自动 | 是 | 是 | 否 |
| 公开Beta/RC | 自动 | 候选阶段可手动 | 正式Tag重新构建 | Pre-release |
| v1.0.0 | 自动 | Tag前候选测试 | 测试Artifact | Tag重新构建后Draft→Publish |

---

# 二十四、当前关键文件

```text
.github/workflows/ci.yml
.github/workflows/desktop-build.yml

package.json

scripts/
  fetch-webview2-bootstrapper.mjs
  build-portable.mjs
  collect-installer.mjs
  generate-install-manifest.mjs
  generate-checksums.mjs
  sync-desktop-version.mjs

src-tauri/
  tauri.conf.json
  tauri.install.conf.json
  nsis/

CHANGELOG.md
README.md
```

v1.0.0前计划新增：

```text
.github/workflows/release.yml
```

---

# 二十五、最简记忆

只需要记住三句话：

> **Push负责自动验证代码。**

> **Desktop Build负责按需生成测试Windows包。**

> **Release Workflow负责从正式Tag重新构建并创建公开版本。**

当前v0.5.1已经完成前两层。

第三层留到v1.0.0正式发布前实现和验证。
