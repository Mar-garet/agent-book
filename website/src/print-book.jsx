import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Printer } from '@phosphor-icons/react';
import { BookMarkdown } from './reading-content';

export function PrintBook({ chapters, documents, resolveLink }) {
  const [pages, setPages] = useState([]);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [diagramError, setDiagramError] = useState(false);
  const book = useRef();
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(chapters.map(async (chapter, index) => {
      const response = await fetch(`./content/${chapter.id}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error('Chapter unavailable');
      const { body } = await response.json();
      return { doc: documents.get(chapter.id), body, id: `chapter-${index + 1}` };
    })).then(setPages).catch((error) => { if (error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, [chapters, documents]);
  useEffect(() => {
    if (pages.length !== chapters.length) return;
    let cancelled = false;
    let fontsReady = false;
    const expected = pages.reduce((sum, page) => sum + (page.body.match(/^```mermaid/gm) || []).length, 0);
    const check = () => {
      if (cancelled || !book.current) return;
      const statuses = [...book.current.querySelectorAll('.diagram-status')];
      setDiagramError(statuses.some((status) => status.textContent.includes('暂未')));
      setReady(fontsReady && !statuses.length && book.current.querySelectorAll('.diagram-image svg').length === expected);
    };
    const observer = new MutationObserver(check);
    observer.observe(book.current, { childList: true, subtree: true });
    document.fonts.ready.then(() => { fontsReady = true; check(); });
    check();
    return () => { cancelled = true; observer.disconnect(); };
  }, [pages, chapters.length]);
  const chapterPosition = useMemo(() => new Map(chapters.map((chapter, index) => [chapter.id, `chapter-${index + 1}`])), [chapters]);
  const printLink = useCallback((href, doc) => {
    if (href?.startsWith('#')) return href;
    const target = resolveLink(href, doc);
    if (target?.startsWith('?read=')) {
      const url = new URL(target, location.href);
      const chapter = chapterPosition.get(url.searchParams.get('read'));
      if (chapter) return `#${chapter}${url.hash ? `-${decodeURIComponent(url.hash.slice(1))}` : ''}`;
    }
    return target;
  }, [chapterPosition, resolveLink]);
  return <main className="print-book-page" id="main-content">
    <header className="print-toolbar">
      <a href="?page=contents"><ArrowLeft size={18} aria-hidden="true" />返回目录</a>
      <div><h1>全书打印</h1><p role="status">{failed ? '部分章节加载失败，请刷新后重试。' : diagramError ? '有图示尚未准备好，请刷新后重试。' : ready ? `${pages.length} 篇正文与全部图示已就绪；打印时保留 TypeScript 和 Python 两份示例。` : '正在装配全书、图示与字体，请稍候…'}</p></div>
      <button className="button primary" disabled={!ready} onClick={() => window.print()}><Printer size={18} aria-hidden="true" />打印 / 保存 PDF</button>
    </header>
    <div className="print-book" ref={book} data-print-ready={ready}>
      <section className="print-cover">
        <p className="print-book-name">Agent Book</p>
        <h2>Agent 的设计思想</h2>
        <p>问题、约束、机制与取舍</p>
        <img src="./assets/agent-design-paths-640.webp" alt="分层结构中的不同设计路径" width="640" height="427" />
        <p className="print-cover-note">从基础概念到系统设计的开源中文书</p>
      </section>
      <nav className="print-contents" aria-label="打印版目录"><h2>目录</h2><ol>{chapters.map((chapter, index) => <li key={chapter.id}><a href={`#chapter-${index + 1}`}>{chapter.title}</a></li>)}</ol></nav>
      {pages.map(({ doc, body, id }, index) => <article className="print-chapter" id={id} key={doc.id}>
        <header><p className="print-chapter-number">第 {index + 1} 篇</p><h2>{doc.displayTitle}</h2></header>
        <div className="prose"><BookMarkdown text={body} doc={doc} theme="print" resolveLink={printLink} printId={id} /></div>
      </article>)}
    </div>
  </main>;
}
