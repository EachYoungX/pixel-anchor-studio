# Pixel Anchor Studio 内部打包与发布指南

本文说明 Windows 测试包、正式版本号和 GitHub Release 的当前操作方式。命令默认在仓库根目录执行。

---

## 一、流程与发布原则

1. 普通 Push 只运行 CI，不生成 Windows 安装包。
2. `Desktop Build` 只手动运行，用来生成指定提交的 Windows 测试包。
3. 正式发布前必须先验证一个确定的提交；通过后只能给这个提交打 Tag。
4. 当前仓库没有 `.github/workflows/release.yml`，正式 Release 需要从 Tag 重新构建并手动建立 Draft Release。

---

## 二、发行形式与推荐顺序

### 便携版（推荐）

文件名：

```text
PixelAnchorStudio-<version>-Portable.zip
```

解压后的应用目录为：

```text
PixelAnchorStudio-Portable
```

数据固定保存在便携目录内：

```text
PixelAnchorStudio-Portable\data
```

便携版无需安装，迁移和备份更直观，因此面向用户时应优先推荐便携版。

### 安装版（不推荐）

文件名：

```text
PixelAnchorStudio-<version>-Setup.exe
```

安装版不提供程序路径或数据路径选择。目录固定为：

```text
程序：%LOCALAPPDATA%\Programs\PixelAnchorStudio
数据：%LOCALAPPDATA%\PixelAnchorStudio\data
```

安装器不显示安装路径或数据路径页面。可见流程包括欢迎/许可证、已有版本维护（仅检测到旧版本时出现）、开始菜单与桌面快捷方式选项、WebView2 检查、安装确认、安装进度和完成页。WebView2 缺失时可在检查页运行随包提供的官方 Bootstrapper。

安装版仅适合希望使用 Windows“已安装的应用”、标准卸载入口和快捷方式管理的用户。README、Release Notes 和下载说明都应明确“不建议安装版，推荐便携版”。

---

## 三、版本号管理

### 版本源

根目录 [`package.json`](../package.json) 的 `version` 是发布版本号的唯一源头。版本应通过统一命令更新，不直接手工编辑版本文件。

以下产物名称都直接读取它：

1. `scripts/build-portable.mjs` 生成 `PixelAnchorStudio-<version>-Portable.zip`；
2. `scripts/collect-installer.mjs` 生成 `PixelAnchorStudio-<version>-Setup.exe`。

`scripts/sync-desktop-version.mjs` 会在桌面构建前把同一版本同步到：

```text
src-tauri/tauri.conf.json
src-tauri/Cargo.toml
src-tauri/resources/README-首次运行.txt 中的便携版校验示例
```

`desktop:build`、`desktop:portable` 和 `desktop:installer` 都会调用同步脚本。因此不需要每次手工修改多个桌面配置文件。

### 版本更新步骤

在干净工作区中执行：

```bash
npm run version:set -- 1.0.0
```

将 `1.0.0` 替换为目标版本，无需打开或修改脚本。命令会依次执行以下操作：

1. 通过 `npm version <version> --no-git-tag-version` 更新 `package.json` 和 `package-lock.json`，不创建提交或 Tag；
2. 同步 `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和便携版校验示例；
3. 重新生成安装清单；
4. 运行 `cargo check` 校验 Rust 工程并让 `Cargo.lock` 与包版本保持一致。

然后检查实际变更：

```bash
git diff -- package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/resources/README-首次运行.txt
```

Setup、Portable 文件名和 `tauri.conf.json` 不应作为独立版本源；后续脚本运行始终以 `package.json` 为准。

统一命令只处理可以机械同步的版本元数据。版本提交还应人工更新：

```text
CHANGELOG.md
README.md 中确实需要随版本变化的内容
Release Notes 草稿
```

版本号修改会产生新提交。即使代码内容没有变化，也必须对这个最终版本提交重新运行 CI 和候选包验证，不能把旧版本号提交的测试结果直接当成正式版本结果。

---

## 四、自动化流程

1. 日常开发：Push 后由 CI 自动检查代码，不生成 Windows 包。
2. Windows 实机验证：手动运行 Desktop Build，生成短期 Artifact。
3. 正式发布：验证候选提交，为同一提交创建 Tag，从 Tag 重新构建，建立 Draft Release，完成抽检后公开发布。

### CI

文件：

```text
.github/workflows/ci.yml
```

触发：

```text
push
pull_request
```

执行：

```text
npm run check
npm run test:e2e
```

CI 不生成 Setup、Portable 或 GitHub Release。

### Desktop Build

文件：

```text
.github/workflows/desktop-build.yml
```

只支持手动 `workflow_dispatch`，使用 GitHub 托管的 `windows-latest` Runner，依次执行：

```text
npm ci
npm run check
Playwright E2E
WebView2 Bootstrapper 下载与校验
便携版构建
NSIS 安装版构建
SHA256SUMS.txt 生成
Artifact 上传
```

Artifact 名称包含提交 SHA：

```text
PixelAnchorStudio-<commit-sha>-windows-x64
```

默认保留 14 天，不会自动创建 Release。

### WebView2 Bootstrapper 锁更新

WebView2 Evergreen Bootstrapper 的官方下载地址不变，但微软会更新该地址返回的文件。`desktop:webview2` 会用 `src-tauri/resources/webview2-bootstrapper.lock.json` 中的 SHA-256 阻止未经审核的新文件进入产物。

出现 SHA-256 不匹配时，不得只为恢复构建而直接复制报错中的哈希。维护者应执行以下检查：

1. 确认文件来自锁文件记录的 `https://go.microsoft.com/` 官方地址；
2. 独立计算 SHA-256，并确认与构建日志报告的实际值一致；
3. 在 Windows 中检查 Authenticode 状态为 `Valid`，签名主体为 `Microsoft Corporation`；
4. 审核通过后运行 `npm run desktop:webview2 -- --record-sha256` 更新锁；
5. 检查锁文件差异，再运行 `npm run desktop:webview2` 验证普通校验路径。

锁更新应形成独立提交，并重新运行 Desktop Build。

---

## 五、Desktop Build 适用范围

以下情况应生成 Windows 测试包：

- 修改 `src-tauri`、Rust、Tauri 权限或原生窗口行为；
- 修改拖放、系统文件打开/保存、单实例或窗口状态；
- 修改 NSIS、安装/卸载逻辑或固定目录；
- 修改便携版、安装清单、WebView2 或校验和脚本；
- 准备阶段性 Windows 测试；
- 准备 Beta、RC 或正式发布候选提交。

普通文案、Web 样式或纯前端小修改通常只需等待 CI；但若它们将进入正式版本，最终候选提交仍需生成完整 Windows 包测试。

---

## 六、候选包的生成与验证

### 1. 记录候选提交

先 Push，等待该提交的 CI 全绿，然后记录完整 SHA：

```bash
git rev-parse HEAD
```

测试记录必须保存完整 SHA，不使用“最新 main”等可变描述。

### 2. 运行 Desktop Build

网页操作：

1. 打开 GitHub 仓库的 `Actions` 页面；
2. 选择 `Desktop Build`；
3. 点击 `Run workflow`；
4. 选择包含候选 SHA 的分支并运行。

工作流完成后，从运行详情页面下载 Artifact。

也可使用 GitHub CLI：

```bash
gh workflow run desktop-build.yml --ref main
gh run list --workflow desktop-build.yml --limit 5
```

### 3. 核对 Artifact

解压后应包含：

```text
PixelAnchorStudio-<version>-Portable.zip
PixelAnchorStudio-<version>-Setup.exe
SHA256SUMS.txt
```

确认 Actions 页面显示的提交 SHA 与候选 SHA 完全一致。

### 4. Windows 实机检查

至少验证：

- Portable 解压、启动、导入、保存项目和导出；
- Portable 数据写入 `PixelAnchorStudio-Portable\data`；
- Setup 不显示安装路径或数据路径页面；
- Setup 固定安装到 `%LOCALAPPDATA%\Programs\PixelAnchorStudio`；
- 安装版数据固定写入 `%LOCALAPPDATA%\PixelAnchorStudio\data`；
- 开始菜单和桌面快捷方式勾选生效；
- 缺少 WebView2 时可以完成依赖安装或给出明确错误；
- 覆盖安装、卸载和所有权保护行为正确；
- 两种发行形式显示的版本号正确；
- `SHA256SUMS.txt` 与两个产物一致。

任何一项失败都应修复并形成新提交，然后重新执行 CI 和候选包构建。失败提交不得创建正式 Tag。

---

## 七、SHA-256 校验

在包含产物和 `SHA256SUMS.txt` 的目录运行：

```powershell
Get-FileHash .\PixelAnchorStudio-*-Setup.exe -Algorithm SHA256
Get-FileHash .\PixelAnchorStudio-*-Portable.zip -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

两个哈希必须逐字符一致。正式 Release 页面必须同时附带 `SHA256SUMS.txt`。

---

## 八、正式 Release 流程

正式发布以已验证的确定提交为对象。候选提交通过全部检查后，正式 Tag 必须指向同一提交。

### 1. 准备最终版本提交

1. 用 `npm run version:set -- <version>` 设置并同步正式版本；
2. 更新 CHANGELOG、README 和 Release Notes；
3. 运行本地检查；
4. Commit、Push；
5. 等待该提交 CI 全绿；
6. 手动构建并实机测试候选包。

推荐本地检查：

```bash
npm run check
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
```

### 2. 为已验证提交创建 Tag

只有候选包全部通过后才执行。假设版本为 `1.0.0`：

```bash
git tag -a v1.0.0 <VERIFIED_COMMIT_SHA> -m "Pixel Anchor Studio v1.0.0"
git show --no-patch --decorate v1.0.0
git push origin v1.0.0
```

Tag 必须直接指向通过 CI 和 Windows 实测的同一个 SHA。测试完成后的任何文档、版本或代码修改都会形成新的候选提交，并需要重新验证。

### 3. 从 Tag 重新生成正式资产

当前没有自动 Release Workflow，因此使用 GitHub CLI 从 Tag 调度现有 Desktop Build：

```bash
gh workflow run desktop-build.yml --ref v1.0.0
gh run list --workflow desktop-build.yml --limit 5
```

在 Actions 页面确认该运行对应的 Commit 与 Tag 指向一致，下载新 Artifact 并再次校验 SHA。正式资产必须来自 Tag 构建，其他提交的 Artifact 不得通过改名作为正式资产。

### 4. 建立 Draft Release

可以使用 GitHub 网页：

1. 打开 `Releases` 页面；
2. 选择 `Draft a new release`；
3. 选择已经创建的 Tag；
4. 上传 Portable、Setup 和 `SHA256SUMS.txt`；
5. 选择 `Save draft`。

也可以在已下载文件位于 `release/` 时使用 GitHub CLI：

```bash
gh release create v1.0.0 release/PixelAnchorStudio-1.0.0-Portable.zip release/PixelAnchorStudio-1.0.0-Setup.exe release/SHA256SUMS.txt --verify-tag --draft --title "Pixel Anchor Studio v1.0.0" --notes-file release-notes.md
```

Draft 中必须检查：

- Tag 和目标 Commit；
- 标题与版本号；
- Portable、Setup、SHA 三个资产；
- 安装版“不推荐”、便携版“推荐”的说明；
- 系统要求、SmartScreen 和未签名提示；
- CHANGELOG 与 Release Notes 一致性。

### 5. 下载 Draft 资产并最终抽检

最终抽检应使用从 Draft 页面重新下载的资产，至少验证：

1. 文件名与版本号；
2. SHA-256；
3. Portable 启动；
4. Setup 安装与启动；
5. 固定安装目录和数据目录；
6. 快捷方式；
7. 核心导入与导出。

全部通过后再点击 `Publish release`，或执行：

```bash
gh release edit v1.0.0 --draft=false
```

已推送的正式 Tag 不得移动或覆盖。发布前后若发现阻断问题，应修复后发布新的补丁版本，例如 `v1.0.1`。

---

## 九、测试 Artifact 与预发布版本

- 仅开发者内部测试：使用 Desktop Build Artifact，不创建 Release。
- 需要公开测试：创建 GitHub Pre-release，例如 `v1.0.0-rc.1`。
- 正式版：候选提交通过后打稳定 Tag，建立 Draft，抽检后 Publish。

测试 Artifact 是短期构建记录，不等同于 Release，也不得通过改名直接作为正式资产。

---

## 十、开发与发布操作顺序

### 日常开发

1. 完成一个可独立说明的开发板块；
2. 创建本地 Commit；
3. Push；
4. 等待 CI 结果。

### 桌面阶段验证

1. Push 阶段性提交；
2. 确认 CI 通过；
3. 手动运行 Desktop Build；
4. 下载 Artifact；
5. 完成 Windows 实机测试。

### 正式发布

1. 设置正式版本号；
2. 创建最终候选提交；
3. 等待 CI 通过；
4. 构建并实测候选 Artifact；
5. 为同一 SHA 创建 Tag；
6. 从 Tag 重新构建正式资产；
7. 建立 Draft Release；
8. 下载 Draft 资产并抽检；
9. 发布 Release。

---

## 十一、操作约束

### Desktop Build 运行频率

Desktop Build 仅用于桌面相关修改、阶段验证或发布候选，不随每次 Push 运行。

### 版本变更后的重新验证

修改版本号会产生新提交，该提交必须重新经过 CI 和候选包验证。

### 版本文件同步

使用 `npm version ... --no-git-tag-version` 修改根版本，再运行 `desktop:sync-version`；各桌面版本文件不单独维护。

### Artifact 与 Release 的区别

Artifact 是 14 天短期测试产物；Release 是绑定 Tag 的公开发行记录。

### Tag 与候选提交的一致性

Tag 必须指向记录并验证过的候选 SHA。

### 正式 Tag 的不可变性

已推送 Tag 不得重写；后续修复使用新的补丁版本。

### 发行形式说明

README、Release Notes 和下载说明都应把 Portable 放在前面，并明确安装版不提供自定义路径且不作为首选。

---

## 十二、关键文件

```text
.github/workflows/ci.yml
.github/workflows/desktop-build.yml

package.json
package-lock.json

scripts/sync-desktop-version.mjs
scripts/fetch-webview2-bootstrapper.mjs
scripts/build-portable.mjs
scripts/collect-installer.mjs
scripts/generate-install-manifest.mjs
scripts/generate-checksums.mjs

src-tauri/tauri.conf.json
src-tauri/tauri.install.conf.json
src-tauri/Cargo.toml
src-tauri/Cargo.lock
src-tauri/nsis/installer.nsi
src-tauri/nsis/installer-hooks.nsh

CHANGELOG.md
README.md
```

如果未来新增 `.github/workflows/release.yml`，应让它仅响应符合规则的 Tag，从 Tag 对应 SHA 重新执行全部检查和 Windows 构建，创建 Draft Release 而不是直接公开发布。在该工作流真正加入并验证前，本指南第八节的手动 Draft 流程是唯一受支持的正式发布方式。
