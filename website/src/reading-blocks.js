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
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
