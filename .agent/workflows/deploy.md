---
description: 提交并上传代码到 Git，同时自动更新版本号
---

每当你完成代码修改并准备上传到 Git 时，请执行以下步骤：

1. **自动更新版本号**：
   运行命令：`node scripts/bump-version.js`
   这会自动增加 `src/version.json` 中的修订号并在控制条显示最新构建时间。

2. **添加文件到暂存区**：
   使用 `git add .` 或者具体的 `git_add_or_commit` 工具添加文件。

3. **提交更改**：
   提交信息应简洁地描述你的修改，例如：`git commit -m "feat: description"`。

4. **推送到远程仓库**：
   执行 `git push`。

// turbo-all
5. 验证执行。
