// Keep callouts in standard GFM syntax so the manuscript also works on GitHub.
const labels = { NOTE: '阅读提示', TIP: '设计建议', IMPORTANT: '关键区别', WARNING: '注意边界' };

export default function readingBlocks() {
  return (tree) => {
    function visit(node) {
      if (node.type === 'blockquote') {
        const first = node.children?.[0]?.children?.[0];
        const match = first?.type === 'text' && first.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING)\][ \t]*(?:\n|$)/);
        if (match) {
          first.value = first.value.slice(match[0].length);
          node.data = { ...node.data, hProperties: { 'data-callout': match[1].toLowerCase(), className: 'reading-callout' } };
          node.children.unshift({ type: 'paragraph', data: { hProperties: { className: 'callout-label' } }, children: [{ type: 'text', value: labels[match[1]] }] });
        }
      }
      if (node.type === 'root') {
        const referenceStart = node.children.findIndex((child) => child.type === 'heading' && child.depth === 2 && child.children?.some((part) => part.value === '延伸阅读'));
        if (referenceStart >= 0) {
          const content = node.children.splice(referenceStart);
          const summary = { type: 'referenceSummary', data: { hName: 'summary' }, children: [{ type: 'text', value: '延伸阅读与实现资料' }] };
          node.children.push({ type: 'referenceSection', data: { hName: 'details', hProperties: { className: 'reading-references' } }, children: [summary, ...content.slice(1)] });
        }
      }
      if (node.children && node.type !== 'codePair') {
        for (let index = 0; index < node.children.length - 1; index++) {
          const first = node.children[index];
          const second = node.children[index + 1];
          if (first.type === 'code' && ['ts', 'typescript'].includes(first.lang) && second.type === 'code' && ['py', 'python'].includes(second.lang)) {
            node.children.splice(index, 2, { type: 'codePair', data: { hName: 'code-pair' }, children: [first, second] });
          }
        }
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
