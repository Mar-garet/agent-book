import React, { Children, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import readingBlocks from './reading-blocks';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Books,
  Check, Code, Copy, FileText, GithubLogo, List, MagnifyingGlass,
  Monitor, Moon, Sun, TextAa, UsersThree, ShieldCheck, X,
} from '@phosphor-icons/react';
import data from './content.json';
import './styles.css';

const GITHUB = 'https://github.com/Mar-garet/agent_book';
const AUTHOR = 'https://github.com/Mar-garet';
const chapters = data.phases.flatMap((phase) => phase.chapters);
const documents = new Map(data.documents.map((doc) => [doc.id, doc]));
const FIRST = chapters[0].id;
const bodyCache = new Map();
let searchIndexPromise;
const categoryNames = {
  coding: '编程与开发', assistant: '助理与浏览器', framework: '框架与编排', memory: '记忆系统',
};
const hrefFor = (id, hash = '') => `?read=${encodeURIComponent(id)}${hash}`;

function readSetting(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(`agent-book-${key}`));
    return value !== null && typeof value === typeof fallback
      && (!Array.isArray(fallback) || Array.isArray(value)) ? value : fallback;
  } catch { return fallback; }
}

function writeSetting(key, value) {
  try { localStorage.setItem(`agent-book-${key}`, JSON.stringify(value)); } catch {}
}

function readRoute() {
  const params = new URLSearchParams(location.search);
  return { read: params.get('read'), page: params.get('page') || 'home', find: params.get('find') || '', hash: location.hash };
}

function resolveLink(href, doc) {
  if (!href || /^(?:https?:|mailto:|tel:)/i.test(href)) return href;
  const resolved = new URL(href, `https://book.local/${doc.path}`);
  const path = decodeURIComponent(resolved.pathname.slice(1));
  const id = path.replace(/\.md$/, '');
  if (documents.has(id)) return hrefFor(id, resolved.hash);
  if (data.attachments.includes(path)) return `./downloads/${path}${resolved.hash}`;
  const [directory, ...rest] = path.replace(/\/+$/, '').split('/');
  const project = data.projects.find((item) => item.directory === directory);
  if (project) {
    return `${project.url}/${rest.length && !resolved.pathname.endsWith('/') ? 'blob' : 'tree'}/${project.commit}${rest.length ? `/${rest.join('/')}` : ''}${resolved.hash}`;
  }
  return `${GITHUB}/blob/main/${path}${resolved.hash}`;
}

function Icon({ icon: Component, ...props }) {
  return <Component size={20} weight="regular" aria-hidden="true" {...props} />;
}

function Sidebar({ current, lastRead, onNavigate }) {
  const navigation = useRef();
  useEffect(() => {
    const nav = navigation.current;
    const link = nav?.querySelector('[aria-current="page"]');
    if (!link || !nav.clientHeight) return;
    const linkBounds = link.getBoundingClientRect();
    const navBounds = nav.getBoundingClientRect();
    if (linkBounds.bottom > navBounds.bottom) nav.scrollTop += linkBounds.bottom - navBounds.bottom + 14;
    else if (linkBounds.top < navBounds.top) nav.scrollTop -= navBounds.top - linkBounds.top + 14;
  }, [current]);
  return <>
    <div className="sidebar-heading"><span>全书目录</span><span className="quiet-count">{chapters.length} 篇</span></div>
    <nav className="chapter-navigation" aria-label="章节目录" ref={navigation}>
      {data.phases.map((phase, index) => <section className="nav-phase" key={phase.title}>
        {(index === 0 || phase.kind !== data.phases[index - 1].kind) && <p className="nav-part">{phase.kind === 'topic' ? '专题篇 · 按系统深入' : '基础篇 · 循序渐进'}</p>}
        <h2>{phase.title.replace(/^理解/, '').replace(/^看见/, '')}</h2>
        {phase.chapters.map((chapter) => <a key={chapter.id} href={hrefFor(chapter.id)}
          className={current === chapter.id ? 'chapter-link current' : 'chapter-link'}
          aria-current={current === chapter.id ? 'page' : undefined} onClick={onNavigate}>
          <span className="chapter-number" aria-hidden={phase.kind === 'topic' ? true : undefined}>{phase.kind === 'topic' ? '·' : String(chapter.number).padStart(2, '0')}</span>
          <span>{phase.kind === 'topic' ? chapter.title : chapter.title.replace(/：.+$/, '')}</span>
        </a>)}
      </section>)}
    </nav>
    <div className="sidebar-bottom">
      <a href={hrefFor('references/evidence')} onClick={onNavigate}><Icon icon={FileText} size={16} />源码与研究<Icon icon={ArrowUpRight} size={14} /></a>
      {lastRead && <a href={hrefFor(lastRead)} onClick={onNavigate} className="last-read">继续上次阅读<Icon icon={ArrowRight} size={14} /></a>}
    </div>
  </>;
}

function Home({ lastRead }) {
  const last = documents.get(lastRead);
  const start = last ? last.id : FIRST;
  const topics = data.phases.filter((phase) => phase.kind === 'topic');
  const topicIcons = [Books, TextAa, Code, UsersThree, ShieldCheck];
  const topicQuestions = [
    '记住什么，什么时候更新？',
    '下一步判断，需要看见什么？',
    '连接之后，谁负责执行？',
    '更多 Agent，怎样共同交付？',
    '怎样确认它真的做完了？',
  ];
  return <main className="home-page page-content" id="main-content" tabIndex={-1}>
    <section className="hero" aria-labelledby="home-title">
      <div className="hero-copy">
        <p className="eyebrow">一本关于 Agent 设计思想的开源书</p>
        <h1 id="home-title">理解 Agent，<span>从设计开始。</span></h1>
        <p className="hero-description">从问题、约束与取舍出发，<br />理解记忆、工具、协作与可靠执行。</p>
        <div className="hero-actions">
          <a className="button primary" href={hrefFor(start)}>{last ? '继续阅读' : '开始阅读'}<Icon icon={ArrowRight} size={18} /></a>
          <a className="button text-button" href="?page=contents">全书目录<Icon icon={ArrowRight} size={17} /></a>
        </div>
      </div>
      <figure className="hero-art">
        <img src="./assets/agent-design-paths.webp" srcSet="./assets/agent-design-paths-640.webp 640w, ./assets/agent-design-paths.webp 1440w" sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1348px) 52vw, 640px" alt="朱红色路径穿过分层建筑结构，象征目标、约束与不同的设计选择" width="1536" height="1024" fetchPriority="high" />
        <figcaption>同一个目标，可以有不同的设计路径。</figcaption>
      </figure>
    </section>

    <section className="book-introduction" aria-labelledby="book-idea">
      <div className="book-idea"><h2 id="book-idea">把 Agent 看成一组设计选择。</h2><p>哪些判断交给模型，哪些规则由程序守住？从具体问题出发，比较不同方案，理解一种设计为什么成立，又会在哪里失效。开源实现与实验，为这些判断提供依据。</p></div>
      <dl className="book-facts" aria-label="书稿概况"><div><dt>篇正文</dt><dd>{chapters.length}</dd></div><div><dt>个系统专题</dt><dd>{topics.length}</dd></div></dl>
    </section>

    <section className="foundations-section" aria-labelledby="foundations-title">
      <div className="foundation-intro">
        <h2 id="foundations-title">先理解，<br />它如何工作。</h2>
        <p>从一次回答，到持续行动。循序渐进地建立概念，再形成自己的判断。</p>
        <a className="opening-feature" href={hrefFor(FIRST)}><BookOpen size={20} aria-hidden="true" /><span>开篇：你真的懂 Agent 吗？</span><Icon icon={ArrowUpRight} size={18} /></a>
      </div>
      <div className="reading-routes">
        {data.phases.filter((phase) => phase.kind === 'foundation').map((phase, index) => <a href={`?page=contents#phase-${index}`} className="reading-route" key={phase.title}>
          <span className="route-index">{String(index + 1).padStart(2, '0')}</span>
          <div><h3>{phase.title}</h3><p>{phase.chapters.map((chapter) => chapter.title.replace(/：.+$/, '')).join(' / ')}</p></div>
          <Icon icon={ArrowUpRight} size={19} />
        </a>)}
      </div>
    </section>

    <section className="system-topics-section" aria-labelledby="system-topics-title">
      <div className="section-heading"><h2 id="system-topics-title">再追问，为什么这样设计。</h2><p>五个系统专题，从代表实现走向机制、取舍与适用边界。</p></div>
      <div className="system-topic-grid">
        {topics.map((phase, index) => <a className="system-topic-card" key={phase.title} href={hrefFor(phase.chapters[0].id)}>
          <span className="topic-symbol"><Icon icon={topicIcons[index]} size={28} /></span>
          <div className="topic-name"><h3>{phase.title}</h3><p>{topicQuestions[index]}</p></div>
          <p className="topic-description">{phase.description}</p>
          <span className="topic-card-link"><span>进入专题</span><Icon icon={ArrowUpRight} size={20} /></span>
        </a>)}
      </div>
    </section>

    <section className="deep-section" aria-labelledby="selected-title">
      <div className="deep-intro"><h2 id="selected-title">从一个具体问题读起。</h2><p>看看直觉会在哪里失效，再理解设计怎样回应。</p></div>
      <div className="deep-stories">
        <a href={hrefFor('book/14-resume-and-side-effects')}><span className="story-kind">恢复与可靠性</span><h3>从断点继续，<br />为什么会再做一遍？</h3><p>检查点保存了进度，外部服务却已完成写入。拆开节点，问题就解决了吗？</p><span className="story-read">阅读这篇<Icon icon={ArrowRight} size={18} /></span></a>
        <a href={hrefFor('book/18-context-compaction')}><span className="story-kind">上下文与信息</span><h3>压缩以后，<br />信息丢在了哪里？</h3><p>有些信息在摘要模型看见之前就已消失。换一个更强的模型，能找回来吗？</p><span className="story-read">阅读这篇<Icon icon={ArrowRight} size={18} /></span></a>
      </div>
    </section>
    <Footer />
  </main>;
}

function Footer() {
  return <footer className="footer"><span>理解 Agent 的设计思想。</span><a href={AUTHOR} target="_blank" rel="noreferrer">Mar-garet<Icon icon={ArrowUpRight} size={14} /></a></footer>;
}

function Contents({ visited }) {
  return <main className="contents-page page-content" id="main-content" tabIndex={-1}>
    <header className="page-heading"><p className="eyebrow">全书目录</p><h1>从零，到设计深处。</h1><p>先循序渐进地建立概念，再按记忆、上下文、工具、协作与可靠执行深入。</p></header>
    <nav className="topic-jump-links" aria-label="系统专题快捷跳转">{data.phases.map((phase, index) => phase.kind === 'topic' && <a key={phase.title} href={`#phase-${index}`}>{phase.title}<Icon icon={ArrowDown} size={14} /></a>)}</nav>
    {data.phases.map((phase, index) => <React.Fragment key={phase.title}>
      {(index === 0 || phase.kind !== data.phases[index - 1].kind) && <div className="contents-part"><span className="small-label">{phase.kind === 'topic' ? 'PART II' : 'PART I'}</span><h2>{phase.kind === 'topic' ? '专题篇 · 比较实现，理解系统设计' : '基础篇 · 从零建立共同语言'}</h2><p>{phase.kind === 'topic' ? '从同一组问题出发，比较不同项目的选择，再沿机制、取舍与失败方式深入。' : '沿一个逐渐复杂的任务，理解 Agent 的参与者、执行过程与基本能力。'}</p></div>}
      <section className="contents-phase" id={`phase-${index}`}>

      <div className="contents-phase-heading"><span>{phase.kind === 'topic' ? '专题' : String(index + 1).padStart(2, '0')}</span><h2>{phase.title}</h2></div>
      {phase.description && <p className="contents-phase-description">{phase.description}</p>}
      <div className="contents-chapters">
        {phase.chapters.map((chapter) => <a className="contents-chapter" href={hrefFor(chapter.id)} key={chapter.id}>
          <span className="chapter-number" aria-hidden={phase.kind === 'topic' ? true : undefined}>{phase.kind === 'topic' ? '·' : String(chapter.number).padStart(2, '0')}</span>
          <div><h3>{chapter.title}</h3><p>{chapter.description}</p></div>
          <span className="chapter-duration">{visited.includes(chapter.id) ? '已浏览' : `约 ${documents.get(chapter.id).minutes} 分钟`}</span><Icon icon={ArrowUpRight} size={19} />
        </a>)}
      </div>
    </section></React.Fragment>)}
    <div className="appendix-links"><h2>源码与实验</h2><div><a href={hrefFor('references/glossary')}>术语表<Icon icon={ArrowUpRight} size={17} /></a><a href={hrefFor('references/studies/README')}>源码研究<Icon icon={ArrowUpRight} size={17} /></a><a href={hrefFor('experiments/README')}>机制实验<Icon icon={ArrowUpRight} size={17} /></a></div></div>
    <Footer />
  </main>;
}

function Projects({ initialQuery }) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  const categories = [...new Set(data.projects.map((project) => project.category))];
  const filtered = data.projects.filter((project) => (category === 'all' || project.category === category)
    && `${project.name} ${project.repository} ${project.question}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="projects-page page-content" id="main-content" tabIndex={-1}>
    <header className="page-heading"><p className="eyebrow">开源项目地图</p><h1>用真实项目，<br />看见不同选择。</h1><p>{data.projects.length} 个固定版本的开源案例。先找到它所在的层次，再比较它承担的责任。</p></header>
    <div className="project-controls">
      <div className="filter-tabs" role="group" aria-label="项目分类"><button aria-pressed={category === 'all'} onClick={() => setCategory('all')}>全部 <span>{data.projects.length}</span></button>{categories.map((item) => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{categoryNames[item] || item}</button>)}</div>
      <label className="project-search"><Icon icon={MagnifyingGlass} size={17} /><span className="sr-only">查找项目</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="查找项目" type="search" /></label>
    </div>
    <p className="project-result-count" role="status">{filtered.length} 个项目 <span>· 下载源码不等于已完成研究，进度见各项目说明。</span></p>
    <div className="project-grid">{filtered.map((project) => <a className="project-card" key={project.directory} href={`${project.url}/tree/${project.commit}`} target="_blank" rel="noreferrer">
      <div className="project-card-top"><Icon icon={Code} size={23} /><Icon icon={ArrowUpRight} size={18} /></div>
      <h2>{project.name}</h2><span className="project-owner">{project.repository}</span><p>{project.question}</p><span className="project-status">{project.status}</span>
    </a>)}</div>
    {!filtered.length && <div className="empty-state"><Icon icon={MagnifyingGlass} size={32} /><h2>没有找到这个项目</h2><p>换个名字，或清除筛选后再试。</p><button className="button secondary" onClick={() => { setQuery(''); setCategory('all'); }}>清除筛选</button></div>}
    <Footer />
  </main>;
}

function MermaidDiagram({ code, theme }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const [result, setResult] = useState({ code: '', svg: '', error: false });
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import('mermaid').then(async ({ default: mermaid }) => {
      const palette = getComputedStyle(document.documentElement);
      const color = (name) => palette.getPropertyValue(name).trim();
      const ink = color('--ink');
      const paper = color('--paper');
      const surface = color('--feature');
      const line = color('--secondary');
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: 'base', suppressErrorRendering: true,
        fontFamily: 'system-ui, sans-serif',
        themeVariables: {
          darkMode: theme === 'dark', useGradient: false,
          background: paper, primaryColor: surface, secondaryColor: paper, tertiaryColor: surface,
          primaryTextColor: ink, secondaryTextColor: ink, tertiaryTextColor: ink, textColor: ink,
          primaryBorderColor: line, secondaryBorderColor: line, tertiaryBorderColor: line,
          lineColor: line, edgeLabelBackground: paper, titleColor: ink,
          stateBkg: surface, stateLabelColor: ink, labelBackgroundColor: paper,
          noteBkgColor: surface, noteTextColor: ink, noteBorderColor: line,
        },
      });
      const { svg } = await mermaid.render(`diagram${id}`, code);
      if (!cancelled) setResult({ code, svg, error: false });
    }).catch(() => { if (!cancelled) setResult({ code, svg: '', error: true }); });
    return () => { cancelled = true; };
  }, [code, theme, id]);
  const title = code.match(/^%%\s+(.+)/)?.[1] || '执行过程与责任流转';
  const naturalWidth = Number(result.svg.match(/viewBox="[^"]*? ([\d.]+) [\d.]+"/)?.[1]) || 680;
  return <figure className={expanded ? 'diagram diagram-expanded' : 'diagram'} style={{ '--diagram-width': `${Math.max(680, naturalWidth)}px` }}>
    <figcaption><span>图解</span>{title}</figcaption>
    <div className="diagram-controls"><span>{expanded ? '可左右滚动查看细节' : '可放大查看细节'}</span><button type="button" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? '适应宽度' : '放大图表'}</button></div>
    {result.code === code && result.svg ? <div className="diagram-image" tabIndex={0} role="img" aria-label={title} dangerouslySetInnerHTML={{ __html: result.svg }} />
      : <p className="diagram-status" role="status">{result.error ? '流程图暂未显示，可以展开文字源码。' : '正在绘制流程图…'}</p>}
    <details><summary>查看图表源码</summary><pre tabIndex={0} aria-label="图表源码"><code>{code}</code></pre></details>
  </figure>;
}

function CodeBlock({ children }) {
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
  return <div className="code-block"><button className="code-copy" onClick={copy} aria-label={copied ? '已复制代码' : '复制代码'}><Icon icon={copied ? Check : Copy} size={16} />{copied ? '已复制' : '复制'}</button><pre tabIndex={0} aria-label="代码示例">{children}</pre>{failed && <span className="copy-error" role="status">复制失败，请选择文本后复制。</span>}</div>;
}

function Reader({ doc, theme, fontSize, setFontSize }) {
  const [activeHeading, setActiveHeading] = useState('');
  const [body, setBody] = useState(() => bodyCache.has(doc.id) ? { text: bodyCache.get(doc.id) } : {});
  const [loadAttempt, setLoadAttempt] = useState(0);
  const article = useRef();
  const chapterIndex = chapters.findIndex((chapter) => chapter.id === doc.id);
  const phase = data.phases.find((item) => item.chapters.some((chapter) => chapter.id === doc.id));
  const previous = chapters[chapterIndex - 1];
  const next = chapters[chapterIndex + 1];
  useEffect(() => {
    if (bodyCache.has(doc.id)) { setBody({ text: bodyCache.get(doc.id) }); return; }
    const controller = new AbortController();
    setBody({});
    fetch(`./content/${doc.id}.json`, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('Chapter could not be loaded');
      return response.json();
    }).then(({ body: text }) => { bodyCache.set(doc.id, text); setBody({ text }); })
      .catch((error) => { if (error.name !== 'AbortError') setBody({ error: true }); });
    return () => controller.abort();
  }, [doc.id, loadAttempt]);
  useEffect(() => {
    setActiveHeading('');
    const observer = new IntersectionObserver((entries) => {
      const heading = entries.find((entry) => entry.isIntersecting);
      if (heading) setActiveHeading(heading.target.id);
    }, { rootMargin: '-90px 0px -65% 0px' });
    article.current?.querySelectorAll('h2[id], h3[id]').forEach((heading) => observer.observe(heading));
    if (body.text && location.hash) {
      try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: 'instant' }); } catch {}
    }
    return () => observer.disconnect();
  }, [doc.id, body.text]);
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
  }), [doc, theme]);
  const markdown = useMemo(() => body.text !== undefined
    ? <Markdown remarkPlugins={[remarkGfm, readingBlocks]} rehypePlugins={[rehypeSlug]} components={components}>{body.text}</Markdown>
    : null, [body.text, components]);
  return <main className="reader-page" id="main-content" tabIndex={-1} style={{ '--reading-size': `${fontSize}px` }}>
    <div className="reading-progress" aria-hidden="true" />
    <div className="reader-grid">
      <article className="reader-article" ref={article}>
        <header className="article-heading">
          <div className="breadcrumbs"><a href="?page=contents">全书目录</a><span>/</span><span>{phase?.title || doc.kind}</span></div>
          <div className="article-meta"><span>{phase?.kind === 'topic' ? '系统专题' : doc.number === null ? doc.kind : doc.number === 0 ? '开篇' : `第 ${doc.number} 章`}</span><span>约 {doc.minutes} 分钟</span></div>
          <h1>{doc.displayTitle}</h1>
          <div className="article-tools"><span>对照源码，理解设计取舍。</span><div className="font-controls" role="group" aria-label="正文字号"><Icon icon={TextAa} size={18} /><button disabled={fontSize <= 16} onClick={() => setFontSize(fontSize - 1)} aria-label="减小字号">小</button><button disabled={fontSize >= 23} onClick={() => setFontSize(fontSize + 1)} aria-label="增大字号">大</button></div></div>
        </header>
        {phase?.kind === 'topic' && phase.chapters.length > 1 && <details className="topic-reading-list"><summary>本专题的 {phase.chapters.length} 篇文章</summary><nav aria-label="本专题文章">{phase.chapters.map((chapter) => <a key={chapter.id} href={hrefFor(chapter.id)} aria-current={doc.id === chapter.id ? 'page' : undefined}>{chapter.title}</a>)}</nav></details>}
        <div className="prose">{body.text !== undefined ? markdown
          : body.error ? <div className="chapter-load-error" role="alert"><p>本章暂未加载成功。</p><button className="button secondary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>重新加载</button></div>
            : <div className="chapter-skeleton" role="status" aria-label="正在加载正文"><span /><span /><span /><span /></div>}</div>
        <div className="article-source"><a href={`./manuscript/${doc.path}`} download={doc.path.split('/').pop()}><Icon icon={FileText} size={17} />下载本章 Markdown<Icon icon={ArrowDown} size={15} /></a></div>
        {chapterIndex >= 0 && <nav className="chapter-pagination" aria-label="前后章节">
          {previous ? <a href={hrefFor(previous.id)}><span><Icon icon={ArrowLeft} size={16} />上一章</span><strong>{previous.title}</strong></a> : <a href="?page=contents"><span><Icon icon={Books} size={16} />阅读路线</span><strong>全书目录</strong></a>}
          {next ? <a href={hrefFor(next.id)} className="next-chapter"><span>下一章<Icon icon={ArrowRight} size={16} /></span><strong>{next.title}</strong></a> : <a href={hrefFor('references/studies/README')} className="next-chapter"><span>继续探索<Icon icon={ArrowRight} size={16} /></span><strong>源码研究与实验</strong></a>}
        </nav>}
      </article>
      <aside className="on-this-page" aria-label="本章目录"><h2>本章内容</h2>{doc.headings.map((heading) => <a key={heading.id} href={hrefFor(doc.id, `#${heading.id}`)} className={`${activeHeading === heading.id ? 'active' : ''} ${heading.level === 3 ? 'nested' : ''}`}>{heading.text}</a>)}<a className="toc-top" href={hrefFor(doc.id, '#main-content')}>回到顶部<Icon icon={ArrowUpRight} size={14} /></a></aside>
    </div>
    <Footer />
  </main>;
}

function SearchDialog({ open, onClose }) {
  const dialog = useRef();
  const input = useRef();
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(null);
  const [searchError, setSearchError] = useState(false);
  const previousFocus = useRef();
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      setQuery(''); dialog.current.showModal(); input.current.focus();
      if (!searchIndexPromise) searchIndexPromise = fetch('./content/search.json').then((response) => {
        if (!response.ok) throw new Error('Search index could not be loaded');
        return response.json();
      }).catch((error) => { searchIndexPromise = undefined; throw error; });
      setSearchError(false);
      searchIndexPromise.then(setSearchIndex).catch(() => setSearchError(true));
    } else if (dialog.current.open) {
      dialog.current.close(); previousFocus.current?.focus();
    }
  }, [open]);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = terms.length ? (searchIndex || []).map((doc) => {
    const title = doc.title.toLowerCase();
    const body = doc.text.toLowerCase();
    if (!terms.every((term) => title.includes(term) || body.includes(term))) return null;
    const start = Math.max(0, body.indexOf(terms[0]) - 28);
    return { id: doc.id, title: doc.displayTitle, kind: doc.kind, href: hrefFor(doc.id), snippet: `${start ? '…' : ''}${doc.text.slice(start, start + 105)}…`, score: terms.reduce((score, term) => score + (title.includes(term) ? 10 : 0), doc.kind === '正文' ? 2 : 0) };
  }).filter(Boolean).concat(data.projects.filter((project) => terms.every((term) => `${project.name} ${project.repository}`.toLowerCase().includes(term))).map((project) => ({ id: project.directory, title: project.name, kind: '开源项目', href: `?page=projects&find=${encodeURIComponent(project.name)}`, snippet: project.question, score: 20 }))).sort((a, b) => b.score - a.score).slice(0, 24) : [];
  return <dialog ref={dialog} className="search-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialog.current) onClose(); }} aria-labelledby="search-title">
    <div className="search-dialog-inner">
      <div className="search-input-row"><Icon icon={MagnifyingGlass} size={23} /><label className="sr-only" htmlFor="book-search" id="search-title">搜索全书</label><input ref={input} id="book-search" type="search" value={query} maxLength={160} placeholder="搜索概念、章节与开源项目…" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); dialog.current.querySelector('.search-result')?.focus(); } }} /><button className="icon-button" onClick={onClose} aria-label="关闭搜索"><Icon icon={X} /></button></div>
      <div className="search-results" aria-live="polite">
        {searchError ? <div className="empty-state" role="alert"><h2>搜索内容暂未加载成功</h2><p>请关闭搜索后重试，也可以从目录继续阅读。</p></div>
          : terms.length && !searchIndex ? <div className="chapter-skeleton" role="status" aria-label="正在准备搜索"><span /><span /><span /></div>
          : !terms.length ? <div className="search-suggestions"><p>从一个问题开始</p>{['工具调用', 'MCP', '记忆', '恢复', 'Pi', 'LangGraph'].map((term) => <button key={term} onClick={() => { setQuery(term); input.current.focus(); }}>{term}<Icon icon={ArrowUpRight} size={14} /></button>)}</div>
          : matches.length ? <><p className="search-summary">找到 {matches.length}{matches.length === 24 ? '+' : ''} 个相关结果</p>{matches.map((match) => <a className="search-result" key={`${match.kind}:${match.id}`} href={match.href} onClick={onClose}><span className="search-result-kind">{match.kind}</span><h3>{match.title}</h3><p>{match.snippet}</p><Icon icon={ArrowUpRight} size={17} /></a>)}</>
            : <div className="empty-state"><h2>没有找到相关内容</h2><p>试试更短的关键词，例如“记忆”或“工具”。</p></div>}
      </div>
      <div className="search-help"><span>搜索正文、研究记录与项目</span><span><kbd>Esc</kbd> 关闭</span></div>
    </div>
  </dialog>;
}

function App() {
  const [route, setRoute] = useState(readRoute);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themePreference, setThemePreference] = useState(() => readSetting('theme', 'system'));
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [fontSize, setFontSize] = useState(() => Math.min(23, Math.max(16, readSetting('font-size', 18))));
  const [lastRead, setLastRead] = useState(() => readSetting('last-read', ''));
  const [visited, setVisited] = useState(() => readSetting('visited', []));
  const drawer = useRef();
  const theme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference;
  const doc = route.read && documents.get(route.read);
  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    const onKey = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setMenuOpen(false); setSearchOpen((value) => !value); } };
    window.addEventListener('popstate', onPop); document.addEventListener('keydown', onKey);
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onTheme = (event) => setSystemDark(event.matches); media.addEventListener('change', onTheme);
    return () => { window.removeEventListener('popstate', onPop); document.removeEventListener('keydown', onKey); media.removeEventListener('change', onTheme); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeSetting('theme', themePreference);
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#20211f' : '#f8f7f3';
  }, [theme, themePreference]);
  useEffect(() => { writeSetting('font-size', fontSize); }, [fontSize]);
  useEffect(() => {
    if (doc && doc.number !== null) {
      setLastRead(doc.id); writeSetting('last-read', doc.id);
      setVisited((current) => { const next = current.includes(doc.id) ? current : [...current, doc.id]; writeSetting('visited', next); return next; });
    }
    document.title = doc ? `${doc.displayTitle} · Agent Book` : route.page === 'projects' ? '开源项目地图 · Agent Book' : route.page === 'contents' ? '全书目录 · Agent Book' : 'Agent Book · Agent 的设计思想';
  }, [doc, route.page]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (route.hash) {
        try {
          const target = document.getElementById(decodeURIComponent(route.hash.slice(1)));
          target?.scrollIntoView({ behavior: 'instant', block: 'start' });
          if (target?.id === 'main-content') target.focus({ preventScroll: true });
        } catch {}
      } else window.scrollTo({ top: 0, behavior: 'instant' });
    }, 30);
    return () => clearTimeout(timer);
  }, [route.read, route.page, route.hash]);
  useEffect(() => {
    if (menuOpen && !drawer.current.open) drawer.current.showModal();
    else if (!menuOpen && drawer.current.open) drawer.current.close();
  }, [menuOpen]);

  function followLink(event) {
    const anchor = event.target.closest('a');
    if (!anchor || anchor.target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    event.preventDefault(); history.pushState(null, '', url); setRoute(readRoute()); setMenuOpen(false);
  }

  const themeIcon = themePreference === 'system' ? Monitor : themePreference === 'dark' ? Moon : Sun;
  const themeLabel = themePreference === 'system' ? '跟随系统' : themePreference === 'dark' ? '深色' : '浅色';
  const isHome = !route.read && !['contents', 'projects'].includes(route.page);
  return <div className={isHome ? 'app home-layout' : 'app'} onClick={followLink}>
    <a className="skip-link" href="#main-content">跳到正文</a>
    <header className="site-header">
      <div className="header-brand"><button className="icon-button mobile-menu-button" aria-label="打开章节目录" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Icon icon={List} size={23} /></button><a className="brand" href={location.pathname}><span className="brand-mark"><Icon icon={BookOpen} size={22} /></span><span>Agent Book<span className="brand-period">.</span></span></a></div>
      <nav className="top-nav" aria-label="主导航"><a href="?page=contents" aria-current={route.page === 'contents' && !route.read ? 'page' : undefined}>全书目录</a><a href="?page=projects" aria-current={route.page === 'projects' && !route.read ? 'page' : undefined}>项目地图</a></nav>
      <div className="header-actions"><button className="search-trigger" onClick={() => { setMenuOpen(false); setSearchOpen(true); }} aria-label="搜索全书"><Icon icon={MagnifyingGlass} size={18} /><span>搜索全书</span><kbd>⌘ K</kbd></button><button className="icon-button theme-toggle" aria-label={`当前${themeLabel}模式，点击切换主题`} title={`当前${themeLabel}模式`} onClick={() => setThemePreference((value) => value === 'system' ? 'light' : value === 'light' ? 'dark' : 'system')}><Icon icon={themeIcon} /></button><a className="icon-button github-link" href={AUTHOR} aria-label="作者 GitHub" target="_blank" rel="noreferrer"><Icon icon={GithubLogo} size={23} /></a></div>
    </header>
    <aside className="sidebar"><Sidebar current={route.read} lastRead={lastRead} /></aside>
    <div className="main-shell">
      {route.read ? doc ? <Reader key={doc.id} doc={doc} theme={theme} fontSize={fontSize} setFontSize={setFontSize} /> : <main className="page-content empty-state" id="main-content"><h1>这一页还没有收录</h1><p>从目录回到已经写好的章节。</p><a className="button primary" href="?page=contents">全书目录<Icon icon={ArrowRight} /></a></main>
        : route.page === 'contents' ? <Contents visited={visited} /> : route.page === 'projects' ? <Projects initialQuery={route.find} /> : <Home lastRead={lastRead} />}
    </div>
    <dialog className="mobile-drawer" ref={drawer} onCancel={(event) => { event.preventDefault(); setMenuOpen(false); }} onClick={(event) => { if (event.target === drawer.current) setMenuOpen(false); }} aria-label="章节目录"><div className="drawer-inner"><div className="drawer-title"><a className="brand" href={location.pathname}>Agent Book.</a><button className="icon-button" aria-label="关闭章节目录" onClick={() => setMenuOpen(false)}><Icon icon={X} /></button></div><Sidebar current={route.read} lastRead={lastRead} onNavigate={() => setMenuOpen(false)} /></div></dialog>
    <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
