# 贡献说明

## 开发约束

- UI保持白色、简约、无阴影、无非必要图标；
- 图片默认只在本地处理；
- 新算法必须提供确定性测试样例；
- 逻辑像素矩阵始终是导出和编辑的唯一数据源；
- 不在组件中重复实现颜色量化或导出逻辑；
- 最大输出尺寸统一由 `MAX_OUTPUT_SIZE` 控制；
- 不直接加入来源和许可证不明确的厂商色板。

## 提交前

```bash
npm run typecheck
npm run test
npm run build
```

功能变化需要同步更新 `CHANGELOG.md`；内部任务和技术债务更新到 `docs/INTERNAL_DEVELOPMENT_PLAN.md`。
