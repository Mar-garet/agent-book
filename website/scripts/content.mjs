import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(await readFile(join(root, 'SOURCES.json'), 'utf8'));
const index = await readFile(join(root, 'book/README.md'), 'utf8');
const comparison = await readFile(join(root, 'book/10-project-comparisons.md'), 'utf8');
const phases = [];
let phase;
for (const line of index.split('\n')) {
  const heading = line.match(/^## (第.+阶段|专题[一二三四五六七八九十]+)：(.+)$/);
  if (heading) {
    phase = { title: heading[2], kind: heading[1].startsWith('专题') ? 'topic' : 'foundation', description: '', chapters: [] };
    phases.push(phase);
  }
  if (line.startsWith('## ') && !heading) phase = undefined;
  const item = line.match(/^(?:(\d+)\.|-) \[([^\]]+)\]\(([^)]+)\)[—\s]*(.*)$/);
  if (phase && !phase.description && line.trim() && !line.startsWith('#') && !item) phase.description = line.trim();
  if (item && phase) {
    phase.chapters.push({
      number: item[1] ? Number(item[1]) : Number(item[3].match(/^\d+/)?.[0]), title: item[2],
      id: `book/${item[3].replace(/\.md$/, '')}`, description: item[4],
    });
  }
}
if (!phases.length) throw new Error('Book reading phases were not found');
const chapterIds = phases.flatMap((item) => item.chapters.map((chapter) => chapter.id));
if (new Set(chapterIds).size !== chapterIds.length) throw new Error('Duplicate chapter in reading route');
for (const file of await readdir(join(root, 'book'))) {
  if (/^\d+.*\.md$/.test(file) && !chapterIds.includes(`book/${file.replace(/\.md$/, '')}`)) {
    throw new Error(`Chapter missing from reading route: ${file}`);
  }
}

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}

const paths = (await Promise.all(['book', 'docs', 'references'].map(
  (directory) => markdownFiles(join(root, directory)),
))).flat().concat(join(root, 'experiments/README.md'));
const documents = [];
for (const file of paths.sort()) {
  const path = relative(root, file).split('\\').join('/');
  const source = await readFile(file, 'utf8');
  const title = source.match(/^# (.+)$/m)?.[1] ?? path;
  const body = source.replace(/^# .+\n+/, '')
    .replace(/\n\[(?:上一章|返回全书目录|对应正文|返回参考资料)[^\n]*\n?$/, '').trim();
  const slugger = new GithubSlugger();
  const headings = [];
  let fenced = false;
  // The title is rendered separately; generate ids for the remaining body.
  for (const line of body.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    const match = !fenced && line.match(/^(#{2,3}) (.+)$/);
    if (match) {
      const text = match[2].replace(/[`*]/g, '');
      headings.push({ text, id: slugger.slug(text), level: match[1].length });
    }
  }
  const text = body.replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*`|\[\]\\]/g, '').replace(/\s+/g, ' ').trim();
  const chapter = phases.flatMap((item) => item.chapters).find(
    (item) => item.id === path.replace(/\.md$/, ''),
  );
  documents.push({
    id: path.replace(/\.md$/, ''), path, title,
    displayTitle: title.replace(/^(?:第.+章|开篇)[:：]\s*/, ''),
    body, text, headings,
    kind: chapter ? '正文' : path.startsWith('references/studies/') ? '源码研究' : '附录',
    minutes: Math.max(1, Math.ceil((text.match(/[\u3400-\u9fff]/g)?.length ?? 0) / 450
      + (text.match(/[A-Za-z]+/g)?.length ?? 0) / 200)),
    number: chapter?.number ?? null,
  });
}
for (const chapter of phases.flatMap((item) => item.chapters)) {
  if (!documents.some((doc) => doc.id === chapter.id)) throw new Error(`Missing chapter: ${chapter.id}`);
}

const browsingCategories = {
  coding: 'coding', personal: 'assistant', general: 'assistant', browser: 'assistant',
  framework: 'framework', 'multi-agent': 'framework', sdk: 'framework', memory: 'memory',
};
const projects = manifest.repositories.map((item) => {
  const escaped = item.directory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const row = comparison.match(new RegExp(`\\| \\[[^\\]]+\\]\\(\\.\\./${escaped}/\\) \\| ([^|]+)\\| ([^|]+)\\|`));
  return {
    name: item.name, directory: item.directory, category: browsingCategories[item.category] || item.category,
    repository: item.repository, url: item.url, commit: item.commit,
    status: row?.[1].trim() ?? '素材已收录', question: row?.[2].trim() ?? '',
  };
});
const contentDirectory = join(root, 'website/public/content');
const manuscriptDirectory = join(root, 'website/public/manuscript');
const downloadsDirectory = join(root, 'website/public/downloads');
await rm(contentDirectory, { recursive: true, force: true });
await rm(manuscriptDirectory, { recursive: true, force: true });
await rm(downloadsDirectory, { recursive: true, force: true });
await mkdir(contentDirectory, { recursive: true });
for (const doc of documents) {
  const destination = join(contentDirectory, `${doc.id}.json`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify({ body: doc.body }));
  const manuscript = join(manuscriptDirectory, doc.path);
  await mkdir(dirname(manuscript), { recursive: true });
  await copyFile(join(root, doc.path), manuscript);
}
const experiments = JSON.parse(await readFile(join(root, 'experiments/manifest.json'), 'utf8'));
const experimentFiles = experiments.experiments.flatMap(
  ({ script, result, dependency_locks: locks }) => [script, result, ...locks],
);
for (const file of experimentFiles) {
  if (!file.startsWith('experiments/') || file.split('/').includes('..')) {
    throw new Error(`Invalid experiment attachment path: ${file}`);
  }
}
const attachments = [...new Set([
  'SOURCES.json', 'experiments/manifest.json', ...experimentFiles, 'scripts/check_book.py',
])];
for (const file of attachments) {
  const destination = join(downloadsDirectory, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, file), destination);
}
await writeFile(join(contentDirectory, 'search.json'), JSON.stringify(documents.map(
  ({ id, title, displayTitle, kind, text }) => ({ id, title, displayTitle, kind, text }),
)));
await writeFile(join(root, 'website/src/content.json'), JSON.stringify({
  phases, documents: documents.map(({ body, text, ...metadata }) => metadata), projects, attachments,
}));
console.log(`Reader content: ${phases.flatMap((item) => item.chapters).length} chapters, ${documents.length} documents, ${projects.length} source projects`);
