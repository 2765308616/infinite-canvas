# 无界画布 · Infinite Canvas

[打开在线画布](https://2765308616.github.io/infinite-canvas/)

个人使用的纯前端无限画布：自由文字、图片、链接卡片、多棵思维导图、关联线、分组、搜索、撤销重做、浏览器自动保存和完整 ZIP 备份。

## 数据

文档与图片保存在当前浏览器的 IndexedDB 中，不发送到 GitHub 或后端服务。不同电脑、浏览器的数据独立；清理浏览器数据前请导出备份。在本机旧版本导出 ZIP，然后在在线版本导入，即可迁移。

每次编辑约 0.6 秒自动保存。历史最近 100 步，仅保留在当前页面会话。单张图片最大 20 MB，支持 PNG/JPEG/WebP/GIF。仅支持单个标签页编辑同一工作区。

## 操作

双击添加文字卡片；拖动空白处平移，滚轮缩放；Shift 点击多选、Shift 拖动框选。卡片圆点可连接普通关联线，卡片加号添加子想法。选中后在属性面板修改颜色、上级、链接或分组。

Ctrl Z/Y 撤销/重做，Ctrl C/V 复制/粘贴，Delete 删除，Tab/Enter 添加子想法/同级想法，Ctrl K 搜索，Ctrl S 保存。输入框与按钮保留正常键盘行为。

## 本地开发与发布

需要 Node.js 24 或更新版本。

```sh
npm ci
npm run dev
npm test -- --run
npm run build:pages
```

GitHub Pages 从 `main` 分支的 `/docs` 文件夹发布。更新后运行 `npm run build:pages`，提交源码和 docs 文件夹并推送 main，GitHub 会自动发布。

技术栈：React、TypeScript、React Flow、Vite、IndexedDB、fflate。无后端、账户、云同步或协作服务。
