import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('search opens a chapter, follows its evidence and preserves browser navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('你真的懂');
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
  await expect(page.locator('.diagram-image svg')).toBeVisible();
  await page.goto('/?read=book%2F10-project-comparisons');
  const source = page.locator('.prose a').filter({ hasText: 'Codex CLI' });
  await expect(source).toHaveAttribute('href', 'https://github.com/openai/codex/tree/5009a99dfc07830ddf7464c26f310a2b8532b55d');
});

for (const width of [375, 768, 1024, 1440]) {
  test(`layout fits the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.hero-art img')).toBeVisible();
    expect(await page.locator('.hero-art img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/preview-${width}.png` });
    if (width < 960) {
      await page.getByRole('button', { name: '打开章节目录' }).click();
      await page.getByRole('dialog', { name: '章节目录' }).getByRole('link', { name: /^03 / }).click();
      await expect(page.getByRole('dialog', { name: '章节目录' })).not.toBeVisible();
    } else {
      await page.locator('.sidebar a').filter({ hasText: '工具调用' }).click();
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
    await expect(page.locator('.diagram-image svg')).toBeVisible();
    const reader = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(reader.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    await page.screenshot({ path: `test-results/reader-${theme}.png` });
  }
});
