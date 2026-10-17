import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const failures = [];
let count = 0;

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.name.endsWith('.md')) result.push(path);
  }
  return result;
}

const paths = (await Promise.all(['book', 'docs', 'references'].map(
  (directory) => files(join(root, directory)),
))).flat().concat(join(root, 'experiments/README.md'));

for (const path of paths.sort()) {
  const source = await readFile(path, 'utf8');
  // Inspect parsed prose, leaving inline code and fenced examples untouched.
  function checkProse() {
    return (tree) => {
      function visit(node) {
        if (node.type === 'text' && /\*\*|__|~~|`/.test(node.value)) {
          failures.push(`${relative(root, path)}:${node.position.start.line}: ${node.value}`);
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(tree);
    };
  }
  renderToStaticMarkup(React.createElement(Markdown, {
    remarkPlugins: [remarkGfm, checkProse],
  }, source));
  count++;
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`Found ${failures.length} unrendered Markdown fragments in ${count} documents.`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${count} documents: no unrendered emphasis, strikethrough or backtick markers in prose.`);
}
