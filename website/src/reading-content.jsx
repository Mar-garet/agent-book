import React, { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { Check, Copy, MagnifyingGlass, ArrowsInSimple } from '@phosphor-icons/react';
import readingBlocks from './reading-blocks';

function scopedIds(prefix) {
  return () => (tree) => {
    function visit(node) {
      if (node.properties?.id) node.properties.id = `${prefix}-${node.properties.id}`;
      if (typeof node.properties?.href === 'string' && node.properties.href.startsWith('#')) {
        node.properties.href = `#${prefix}-${node.properties.href.slice(1)}`;
      }
      for (const child of node.children || []) visit(child);
    }
    visit(tree);
  };
}

export function MermaidDiagram({ code, theme = 'light' }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const [result, setResult] = useState({ code: '', svg: '', error: false });
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import('mermaid').then(async ({ default: mermaid }) => {
      const palette = getComputedStyle(document.documentElement);
      const color = (name) => palette.getPropertyValue(name).trim();
      const ink = theme === 'print' ? '#252922' : color('--ink');
      const paper = theme === 'print' ? '#ffffff' : color('--paper');
      const surface = theme === 'print' ? '#f3f4ef' : color('--surface');
      const line = theme === 'print' ? '#72776b' : color('--secondary');
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: 'base', suppressErrorRendering: true,
        fontFamily: 'Arial, PingFang SC, Microsoft YaHei, sans-serif',
        flowchart: { htmlLabels: false, curve: 'linear', nodeSpacing: 28, rankSpacing: 42, padding: 14 },
        sequence: { useMaxWidth: true, wrap: true, mirrorActors: false, actorMargin: 36, messageMargin: 32, diagramMarginX: 12, diagramMarginY: 16 },
        themeVariables: {
          darkMode: theme === 'dark', fontSize: '15px', useGradient: false,
          background: paper, primaryColor: surface, secondaryColor: paper, tertiaryColor: surface,
          primaryTextColor: ink, secondaryTextColor: ink, tertiaryTextColor: ink, textColor: ink,
          primaryBorderColor: line, secondaryBorderColor: line, tertiaryBorderColor: line,
          lineColor: line, edgeLabelBackground: paper, titleColor: ink,
          clusterBkg: surface, clusterBorder: line,
          actorBkg: surface, actorBorder: line, actorTextColor: ink, actorLineColor: line,
          signalColor: line, signalTextColor: ink, labelBoxBkgColor: surface, labelBoxBorderColor: line,
          stateBkg: surface, stateLabelColor: ink, labelBackgroundColor: paper,
          noteBkgColor: surface, noteTextColor: ink, noteBorderColor: line,
        },
        themeCSS: '.node rect,.node polygon,.node circle {stroke-width:1.1px} .node rect {rx:5px;ry:5px} .edgePath .path {stroke-width:1.3px} .label {font-weight:500} .cluster rect {rx:7px;ry:7px} .messageText {font-size:14px!important}',
      });
      const { svg } = await mermaid.render(`diagram${id}`, code);
      if (!cancelled) setResult({ code, svg, error: false });
    }).catch(() => { if (!cancelled) setResult({ code, svg: '', error: true }); });
    return () => { cancelled = true; };
  }, [code, theme, id]);
  const title = code.match(/^%%\s+(.+)/)?.[1] || '执行过程';
  const naturalWidth = Number(result.svg.match(/viewBox="[^"]*? ([\d.]+) [\d.]+"/)?.[1]) || 680;
  return <figure className={expanded ? 'diagram diagram-expanded' : 'diagram'} style={{ '--diagram-width': `${Math.max(680, naturalWidth)}px` }}>
    <figcaption><span>图解</span>{title}</figcaption>
    <div className="diagram-controls"><button type="button" aria-label={expanded ? '适应图表宽度' : '放大图表'} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <ArrowsInSimple size={16} aria-hidden="true" /> : <MagnifyingGlass size={16} aria-hidden="true" />}{expanded ? '适应宽度' : '放大图表'}</button></div>
    {result.code === code && result.svg ? <div className="diagram-image" tabIndex={0} role="img" aria-label={title} dangerouslySetInnerHTML={{ __html: result.svg }} />
      : <p className="diagram-status" role="status">{result.error ? '图示暂未生成，可以查看下面的文字流程。' : '正在准备图示…'}</p>}
    <details className="diagram-source"><summary>查看文字流程</summary><pre tabIndex={0} aria-label="图表源码"><code>{code}</code></pre></details>
  </figure>;
}

function codeLanguage(children) {
  const first = Children.toArray(children).find(isValidElement);
  const language = first?.props?.className?.replace('language-', '') || '';
  return ({ ts: 'TypeScript', typescript: 'TypeScript', py: 'Python', python: 'Python', json: 'JSON', bash: 'Shell' })[language] || language || '示例';
}

export function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(String(Children.toArray(children)[0]?.props?.children || ''));
      setCopied(true); setFailed(false);
      clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setFailed(true); }
  }
  return <div className="code-block"><div className="code-toolbar"><span>{codeLanguage(children)}</span><button className="code-copy" onClick={copy} aria-label={copied ? '已复制代码' : '复制代码'}>{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copied ? '已复制' : '复制'}</button></div><pre tabIndex={0} aria-label="代码示例">{children}</pre>{failed && <span className="copy-error" role="status">复制失败，请选择文本后复制。</span>}</div>;
}

function CodePair({ children }) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const blocks = Children.toArray(children).filter(isValidElement);
  const languages = ['TypeScript', 'Python'];
  return <section className="code-comparison" aria-label="同一机制的两种语言实现">
    <div className="code-language-tabs" role="tablist" aria-label="代码语言">
      {languages.map((language, index) => <button key={language} id={`${id}-tab-${index}`} role="tab" type="button" aria-selected={selected === index} aria-controls={`${id}-panel-${index}`} tabIndex={selected === index ? 0 : -1}
        onClick={() => setSelected(index)} onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - selected;
            setSelected(next); document.getElementById(`${id}-tab-${next}`)?.focus();
          }
        }}>{language}</button>)}
    </div>
    {blocks.map((block, index) => <div key={languages[index]} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={selected !== index}>{block}</div>)}
  </section>;
}

export function BookMarkdown({ text, doc, theme, resolveLink, printId }) {
  const components = useMemo(() => ({
    a: ({ href, children }) => {
      const target = resolveLink(href, doc);
      const external = /^https?:/.test(target || '');
      return <a href={target} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{children}</a>;
    },
    table: ({ children }) => <div className="table-scroll" tabIndex={0} role="region" aria-label="对照表"><table>{children}</table></div>,
    pre: ({ children }) => {
      const child = Children.toArray(children)[0];
      if (child?.props?.className === 'language-mermaid') return <MermaidDiagram code={String(child.props.children).trim()} theme={theme} />;
      return <CodeBlock>{children}</CodeBlock>;
    },
    'code-pair': CodePair,
  }), [doc, theme, resolveLink]);
  const plugins = useMemo(() => printId ? [rehypeSlug, scopedIds(printId)] : [rehypeSlug], [printId]);
  return <Markdown remarkPlugins={[remarkGfm, readingBlocks]} rehypePlugins={plugins} components={components}>{text}</Markdown>;
}
