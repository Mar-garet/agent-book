# 首页视觉说明

2026-10-17：首页采用技术书籍的出版物排版。保留纸白、朱红、现有字标和阅读页目录；首页使用完整页面介绍书的定位，进入正文后回到章节侧栏。正文、项目和目录的 URL 保持不变。

主视觉用分层结构、分叉和回路表达目标、约束与设计选择。它是概念插图，不对应某个框架的真实系统架构。插图使用内置 imagegen 生成，再由 Sharp 编码为 WebP；没有使用 CLI 图像 API。

## 资源

- [首页插图](public/assets/agent-design-paths.webp)：1440 × 960，透明背景。
- [小屏插图](public/assets/agent-design-paths-640.webp)：640 × 427，透明背景。
- [社交分享图](public/assets/agent-design-paths-social.webp)：1200 × 630，纸白背景。

首页插图按显示宽度加载对应版本，预留比例并优先加载。深色主题使用 `invert(1) hue-rotate(180deg)`，将墨线转为浅色，同时保持路径接近朱红色。整页使用既有语义色值，交互只保留轻微反馈，并遵循减少动态效果的系统偏好。

## 生成提示词

```text
Use case: illustration-story. Asset type: original editorial hero illustration for Agent Book, a serious technical book about the design philosophy of AI agents. Create a precise, striking two-dimensional architectural cutaway of a small abstract system of branching paths and connected platforms. One muted vermilion path passes through the structure, makes a deliberate fork, reconnects, and feeds back. Black ink architecture expresses constraints and alternatives; the single red path expresses a chosen design. Three compact offset levels connected by stairs and bridges, elegant and structurally coherent, asymmetrical but balanced. A few thin red construction lines only where they clarify relationships. Commissioned computer science book-cover quality, a modernist architectural engraving with a Japanese technical editorial print sensibility. Meticulous crisp charcoal ink linework, restrained fine hatching, bold negative spaces, limited two-color print. Flat print aesthetic with axonometric geometry, not photorealistic 3D. Transparent background. Isolated complete composition, generous clear margins, landscape 3:2 composition. No text, letters, numbers, labels, logo, frame, UI, robot, brain, floating spheres, isolated prop cubes, paper ribbon, gradients, glow, drop shadow or photographic background. Full silhouette legible at 500px wide. Only charcoal and muted vermilion.
```
