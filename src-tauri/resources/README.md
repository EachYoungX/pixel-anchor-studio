# 构建资源

发布构建前，通过 `node scripts/fetch-webview2-bootstrapper.mjs` 下载微软官方 Evergreen Bootstrapper，并根据 `webview2-bootstrapper.lock.json` 校验 SHA-256。二进制文件不会提交到 Git。
