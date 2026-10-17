# Agent Book 阅读界面

[在线阅读，免登录访问](https://agent-book-mar-garet.ivorytoast129.chatgpt.site/)。

纸白底色、朱红点缀与出版物排版，为长文阅读组织目录、正文和证据。章节与研究记录来自主仓库的 Markdown，项目地图来自 SOURCES.json 和第十章，内容维护仍在原文件中完成。

![阅读首页](../docs/assets/reader-desktop.webp)

## 本地打开

需要 Node.js 22.12 或更新版本。在本书根目录运行：

```bash
npm ci --prefix website
npm run dev --prefix website
```

打开 [本地阅读界面](http://127.0.0.1:4173/)。界面构建读取书稿与项目索引，不需要初始化上游源码子模块。修改 Markdown 后，重新运行开发或构建命令即可更新生成内容。

## 阅读方式

- 侧栏按五个阅读阶段组织正文；阅读页提供本章目录和前后章节。
- 搜索覆盖正文、研究记录与项目，支持按钮或 `⌘ K` / `Ctrl K` 打开，`Esc` 关闭。
- 项目地图支持分类与名称筛选，链接指向收录时的固定提交。
- 主题默认跟随系统，也可手动切换；主题、字号与上次阅读位置保存在当前浏览器。
- 表格可横向查看，Mermaid 流程图按需绘制，源码引用保留固定提交与行号。
- 原始 Markdown 与实验附件随网站提供，无需访问源码仓库即可查看或下载。
- 窄屏使用可收起的目录，浏览器打印可输出当前章节。

![章节阅读与本章目录](../docs/assets/reader-chapter.webp)

[查看手机布局](../docs/assets/reader-mobile.webp)。

## 构建与核验

```bash
npm run build --prefix website
npm test --prefix website
```

产物在 `website/dist/`，使用相对资源地址和查询参数路由，可放在静态服务器的根目录或子目录。测试采用本机 Chrome；其他机器可在安装 Playwright Chromium 后，移除测试配置中的 `channel: 'chrome'`。

构建脚本将正文与搜索索引拆成静态文件，按需加载；生成文件、依赖和测试截图不提交到 Git。上游源码的本地链接在阅读页转换为固定版本的 GitHub 链接，书内 Markdown 链接则进入对应阅读页。

公开站点由 Sites 托管，项目标识与静态产物目录记录在主仓库的 `.openai/hosting.json`。更新时使用同一项目发布新的构建版本。网站访问范围与 GitHub 仓库访问范围分别管理。

自动测试覆盖搜索、导航、固定版本链接、图表、主题与字号持久化、375/768/1024/1440px 布局，以及深浅模式下的可访问性规则检查。自动检查不替代实际阅读体验检查。

需要更新仓库中的界面预览时，测试通过后运行 `npm run previews --prefix website`。截图来自实际运行的阅读界面。

封面插图由图像生成工具创作，作为本书的概念插图使用；字体 Newsreader 通过 Fontsource 在本地打包，中文采用系统宋体与系统无衬线字体。

[返回本书首页](../README.md) · [原始 Markdown 目录](../book/README.md)
