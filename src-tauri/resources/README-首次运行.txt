锚点像素工作台 Windows 便携版

1. 请先完整解压 ZIP，再运行 PixelAnchorStudio.exe。不要直接从压缩包内运行。
2. 应用自身数据保存在本目录的 data 文件夹中。移动整个目录即可迁移应用和设置。
3. 删除整个便携目录会同时删除目录内的所有文件。请先将需要保留的项目和导出结果移动到其他位置。
4. 应用使用系统 Microsoft Edge WebView2 Runtime。缺少时可按原生提示运行随包提供的微软安装程序，首次依赖安装需要网络；安装完成后应用核心功能可离线使用。
5. 当前桌面测试版本尚未进行 Windows 代码签名。请只从官方 GitHub 仓库的 Actions Artifact 或 Release 下载并核对 SHA-256；出现 SmartScreen 提示时点击“更多信息”，检查应用名称后再选择“仍要运行”。不要关闭 SmartScreen，也不要从第三方网站下载安装包。

PowerShell 校验示例：
Get-FileHash .\PixelAnchorStudio-0.5.1-Portable.zip -Algorithm SHA256
