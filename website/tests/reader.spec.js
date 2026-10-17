import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Chinese emphasis renders without leaking Markdown punctuation into prose', async ({ page }) => {
  for (const [id, label] of [
    ['book/06-memory', '跨任务的持久信息'],
    ['book/18-context-compaction', '只有前 2,000 个字符串单位'],
    ['references/studies/tool-results-and-retries', '默认策略不是捕获所有工具执行异常'],
    ['references/studies/trust-and-tool-content', '来源提示与技术强制的边界'],
  ]) {
    await page.goto(`/?read=${encodeURIComponent(id)}`);
    await expect(page.locator('.prose strong').filter({ hasText: label }).first()).toBeVisible();
    await expect(page.locator('.prose')).not.toContainText('**');
  }
});

test('search opens a chapter, follows its sources and preserves browser navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('理解 Agent');
  await page.getByRole('button', { name: '搜索全书', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '搜索全书', exact: true });
  await dialog.getByRole('searchbox').fill('从断点继续');
  await dialog.locator('.search-result').filter({ hasText: '为什么会再做一遍' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('从断点继续，为什么会再做一遍？');
  await expect(page.locator('.sidebar [aria-current="page"]')).toBeInViewport();
  await expect(page.locator('.prose')).toContainText('两张审查单');
  await page.locator('.prose a').filter({ hasText: '源码研究记录' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('LangGraph');
  await expect(page.locator('.prose a[href*="github.com/langchain-ai/langgraph/blob/41c9c22"]')).not.toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('从断点继续，为什么会再做一遍？');
  await page.locator('.on-this-page a').filter({ hasText: '拆开节点' }).click();
  await expect(page).toHaveURL(/#/);
  await expect(page.locator('.prose h2').filter({ hasText: '拆开节点' })).toBeInViewport();
  expect(errors).toEqual([]);
});

test('project search and category filters preserve the fixed source snapshot', async ({ page }) => {
  await page.goto('/?page=projects');
  await expect(page.locator('.project-card')).toHaveCount(32);
  await page.getByRole('searchbox', { name: '查找项目' }).fill('LangGraph');
  await expect(page.locator('.project-card')).toHaveCount(2);
  await expect(page.locator('.project-card').first()).toHaveAttribute('href', /\/tree\/[a-f0-9]{40}$/);
  await page.getByRole('searchbox', { name: '查找项目' }).fill('no-such-agent-567');
  await expect(page.getByRole('heading', { name: '没有找到这个项目' })).toBeVisible();
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.locator('.project-card')).toHaveCount(32);
  await page.getByRole('button', { name: '编程与开发' }).click();
  await expect(page.locator('.project-card')).toHaveCount(8);
});

test('the public reader serves manuscripts and experiment records without GitHub access', async ({ page }) => {
  const homeImages = [];
  page.on('request', (request) => { if (request.url().includes('/assets/agent-design-paths')) homeImages.push(request.url()); });
  await page.goto('/?read=book%2F14-resume-and-side-effects');
  const manuscript = page.getByRole('link', { name: '下载本章 Markdown' });
  await expect(manuscript).toHaveAttribute('href', './manuscript/book/14-resume-and-side-effects.md');
  const raw = await page.request.get('/manuscript/book/14-resume-and-side-effects.md');
  expect(raw.ok()).toBe(true);
  expect(await raw.text()).toContain('# 从断点继续，为什么会再做一遍？');
  await expect(page.locator('.prose a').filter({ hasText: '原始结果' })).toHaveAttribute('href', './downloads/experiments/results/langgraph-interrupt-replay.json');
  const results = await page.request.get('/downloads/experiments/results/langgraph-interrupt-replay.json');
  expect(results.ok()).toBe(true);
  expect((await results.json()).cases).toHaveLength(4);
  expect(homeImages).toEqual([]);
  await expect(page.getByRole('link', { name: '作者 GitHub' })).toHaveAttribute('href', 'https://github.com/Mar-garet');
});

test('later chapters remain connected and all experiment attachments are public', async ({ page }) => {
  await page.goto('/?read=book%2F16-mcp-host-differences');
  await page.locator('.next-chapter').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('工具返回了，任务为什么还没有完成？');
  await expect(page.locator('.diagram-image svg').first()).toBeVisible();
  for (const title of ['协作系统：更多 Agent，怎样共同交付一份结果？', '可靠执行系统：让动作可控、过程可恢复、结果可核查']) {
    await page.locator('.next-chapter').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.locator('.prose h2').first()).toBeVisible();
  }
  await page.goto('/?read=book%2F22-evaluation-and-completion');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('评测系统：让任务完成成为可复核的结论');
  await expect(page.locator('.prose a').filter({ hasText: '离线验收记录' })).toHaveAttribute('href', './downloads/experiments/results/task-acceptance.json');
  const manifestResponse = await page.request.get('/downloads/experiments/manifest.json');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.experiments).toHaveLength(5);
  for (const experiment of manifest.experiments) {
    const result = await page.request.get(`/downloads/${experiment.result}`);
    expect(result.ok()).toBe(true);
    expect((await result.json()).cases).toHaveLength(experiment.case_count);
    for (const file of [experiment.script, ...experiment.dependency_locks]) {
      const response = await page.request.get(`/downloads/${file}`);
      expect(response.ok()).toBe(true);
      expect(await response.text()).not.toContain('<!doctype html>');
    }
  }
});

test('theme and reading size survive a reload and Escape returns search focus', async ({ page }) => {
  await page.goto('/?read=book%2F06-memory');
  await expect(page.locator('.prose')).toContainText('昨天');
  await page.getByRole('button', { name: '增大字号' }).click();
  await expect(page.locator('.prose')).toHaveCSS('font-size', '19px');
  await page.getByRole('button', { name: /点击切换主题/ }).click();
  await page.getByRole('button', { name: /点击切换主题/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('.prose')).toHaveCSS('font-size', '19px');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const trigger = page.getByRole('button', { name: '搜索全书', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: '搜索全书' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '搜索全书' })).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('MCP diagrams render and an upstream directory link stays on its pinned commit', async ({ page }) => {
  await page.goto('/?read=book%2F04-mcp');
  await expect(page.locator('.diagram-image svg').first()).toBeVisible();
  await page.goto('/?read=references%2Fproject-map');
  const source = page.locator('.prose a').filter({ hasText: 'Codex CLI' });
  await expect(source).toHaveAttribute('href', 'https://github.com/openai/codex/tree/5009a99dfc07830ddf7464c26f310a2b8532b55d');
});

for (const width of [375, 768, 1024, 1440]) {
  test(`layout fits the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.hero-art img')).toBeVisible();
    await expect.poll(() => page.locator('.hero-art img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/preview-${width}.png` });
    if (width < 960) {
      await page.getByRole('button', { name: '打开章节目录' }).click();
      await page.getByRole('dialog', { name: '章节目录' }).getByRole('link', { name: /^03 / }).click();
      await expect(page.getByRole('dialog', { name: '章节目录' })).not.toBeVisible();
    } else {
      await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '全书目录', exact: true }).click();
      await page.locator('.contents-chapter').filter({ hasText: '工具调用' }).click();
    }
    await expect(page.getByRole('heading', { level: 1 })).toContainText('工具调用');
    await expect(page.locator('.prose h2').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('home and reader pass automated accessibility checks in light and dark themes', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => localStorage.setItem('agent-book-theme', JSON.stringify(value)), theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const home = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(home.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    await page.screenshot({ path: `test-results/home-${theme}.png` });
    await page.goto('/?read=book%2F14-resume-and-side-effects');
    await expect(page.locator('.diagram-image svg').first()).toBeVisible();
    const reader = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(reader.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    await page.screenshot({ path: `test-results/reader-${theme}.png` });
  }
});


test('contents separates foundations and system topics without losing or duplicating chapters', async ({ page }) => {
  await page.goto('/?page=contents');
  await expect(page.locator('.contents-part')).toHaveCount(2);
  await expect(page.locator('.contents-part').last()).toContainText('专题篇');
  await expect(page.locator('.contents-chapter')).toHaveCount(23);
  const hrefs = await page.locator('.contents-chapter').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(new Set(hrefs).size).toBe(23);
  await page.locator('.contents-chapter').filter({ hasText: '记忆系统：从项目比较' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('记忆系统：从项目比较到写入、检索与更新');
  await expect(page.locator('.article-meta')).toContainText('系统专题');
  await expect(page.locator('.article-meta')).not.toContainText('第 15 章');
  await page.locator('.next-chapter').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('上下文系统：让下一步判断拿到合适的依据');
  await page.locator('.next-chapter').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('上下文压缩：信息怎样在交接处丢失');
});

for (const width of [375, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`memory topic diagrams, callouts and comparison tables render at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      await page.evaluate((value) => localStorage.setItem('agent-book-theme', JSON.stringify(value)), theme);
      await page.goto('/?read=book%2F15-memory-update-boundaries');
      await expect(page.locator('.diagram-image svg')).toHaveCount(2);
      await expect(page.locator('.reading-callout')).toHaveCount(2);
      await expect(page.locator('.reading-callout').first()).toContainText('阅读提示');
      await expect(page.locator('.prose')).not.toContainText('[!NOTE]');
      await expect(page.locator('.prose')).not.toContainText('**');
      const comparison = page.locator('.table-scroll').first();
      await expect(comparison.locator('th')).toHaveText(['比较维度', 'Hermes', 'OpenClaw', 'LangGraph']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const findings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(findings.violations.map(({ id }) => id)).toEqual([]);
      await page.locator('.diagram').first().evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `test-results/memory-${width}-${theme}.png` });
      await comparison.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/memory-comparison-${width}-${theme}.png` });
      const diagram = page.locator('.diagram').first();
      await diagram.getByRole('button', { name: '放大图表' }).click();
      await expect(diagram.getByRole('button', { name: '适应宽度' })).toHaveAttribute('aria-pressed', 'true');
      expect(await diagram.locator('svg').evaluate((svg) => svg.getBoundingClientRect().width >= Math.min(680, svg.viewBox.baseVal.width))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}


test('home topic cards and contents shortcuts lead to the complete system articles', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.system-topic-card')).toHaveCount(5);
  await page.locator('.system-topics-section').screenshot({ path: 'test-results/home-system-topics.png' });
  await page.locator('.system-topic-card').filter({ hasText: '协作系统' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('协作系统：');
  await page.goto('/?page=contents');
  const shortcuts = page.getByRole('navigation', { name: '系统专题快捷跳转' });
  await expect(shortcuts.getByRole('link')).toHaveCount(5);
  await shortcuts.getByRole('link', { name: '工具与 MCP 系统' }).click();
  await expect(page.locator('#phase-6 h2')).toBeInViewport();
  await page.locator('#phase-6 .contents-chapter').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('工具与 MCP 系统：');
  await page.locator('.topic-reading-list summary').click();
  await page.getByRole('navigation', { name: '本专题文章' }).getByRole('link').last().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('工具返回了，任务为什么还没有完成？');
});

const systemArticles = [
  '12-action-boundaries', '13-context-and-defaults', '14-resume-and-side-effects',
  '16-mcp-host-differences', '17-tool-results-and-retries', '18-context-compaction',
  '19-delegation-and-handoffs', '20-trust-boundaries', '21-execution-budgets', '22-evaluation-and-completion',
].map((id) => {
  const source = readFileSync(new URL(`../../book/${id}.md`, import.meta.url), 'utf8');
  return { id, title: source.split('\n')[0].replace(/^# /, ''), diagrams: (source.match(/^```mermaid/gm) || []).length };
});

for (const [width, theme] of [[375, 'dark'], [1440, 'light']]) {
  test(`all system articles render their diagrams and prose at ${width}px in ${theme}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate((value) => localStorage.setItem('agent-book-theme', JSON.stringify(value)), theme);
    for (const article of systemArticles) {
      await page.goto(`/?read=${encodeURIComponent(`book/${article.id}`)}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.title);
      await expect(page.locator('.diagram-image svg')).toHaveCount(article.diagrams);
      await expect(page.locator('.diagram-status')).toHaveCount(0);
      await expect(page.locator('.prose')).not.toContainText(/\[!(NOTE|TIP|WARNING|IMPORTANT)\]/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const findings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(findings.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
      if (['13-context-and-defaults', '16-mcp-host-differences', '19-delegation-and-handoffs', '12-action-boundaries', '22-evaluation-and-completion'].includes(article.id)) {
        await page.screenshot({ path: `test-results/system-${article.id}-${width}-${theme}.png` });
      }
    }
  });
}
