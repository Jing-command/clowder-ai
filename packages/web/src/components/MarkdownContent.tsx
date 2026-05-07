'use client';

import { Children, type ReactNode, useCallback, useRef, useState } from 'react';
import rehypeKatex from 'rehype-katex';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { getMentionColor, getMentionRe, getMentionToCat } from '@/lib/mention-highlight';
import { useChatStore } from '@/stores/chatStore';
import { createWorkspaceImageComponent, createWorkspaceLinkComponent } from './workspace-md-components';

/* ── @mention highlighting ─────────────────────────────────── */

function highlightMentions(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  const re = getMentionRe();
  const toCat = getMentionToCat();
  const colorMap = getMentionColor();

  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    const catId = toCat[m[1].toLowerCase()] ?? 'opus';
    const catColor = colorMap[catId] ?? '#9B7EBD';
    const r = Number.parseInt(catColor.slice(1, 3), 16);
    const g = Number.parseInt(catColor.slice(3, 5), 16);
    const b = Number.parseInt(catColor.slice(5, 7), 16);
    parts.push(
      <span
        key={`m${m.index}`}
        className="font-semibold"
        style={{
          color: catColor,
          backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
          borderRadius: 4,
          padding: '1px 5px',
        }}
      >
        {m[0]}
      </span>,
    );
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

/** Process immediate string children → highlight @mentions */
function withMentions(children: ReactNode): ReactNode {
  return Children.map(children, (child) => (typeof child === 'string' ? highlightMentions(child) : child));
}

/* ── Code block with copy button ───────────────────────────── */
function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = useCallback(() => {
    const text = preRef.current?.textContent ?? '';
    void navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, []);

  return (
    <div className="relative group my-2">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-cafe-muted md:opacity-0 md:group-hover:opacity-100 hover:bg-gray-600 transition-opacity"
      >
        {copied ? '已复制' : '复制'}
      </button>
      <pre
        ref={preRef}
        className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs leading-5 font-mono [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit [&>code]:text-xs"
      >
        {children}
      </pre>
    </div>
  );
}

/* ── File path → VSCode link ──────────────────────────────── */
const PROJECT_ROOT = process.env.NEXT_PUBLIC_PROJECT_ROOT ?? '';
const FILE_PATH_RE = /(?:^|\s)`?((?:\/[\w.@-]+)+(?:\.[\w]+)(?::(\d+))?)(?:`?)/g;
const REL_PATH_RE = /(?:^|\s)`?((?:packages|src|docs|tests?)\/[\w./@-]+(?:\.[\w]+)(?::(\d+))?)(?:`?)/g;
const WT_TAG_RE = /^\s*\[wt:([a-zA-Z0-9_/-]+)\]/;

function linkifyFilePaths(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  const combined = new RegExp(`${FILE_PATH_RE.source}|${REL_PATH_RE.source}`, 'g');
  let m: RegExpExecArray | null;

  combined.lastIndex = 0;
  while ((m = combined.exec(text)) !== null) {
    const fullMatch = m[0];
    const leading = fullMatch.match(/^\s/)?.[0] ?? '';
    const path = m[1] ?? m[3];
    const line = m[2] ?? m[4];
    if (!path) continue;

    const start = m.index + leading.length;
    if (start > lastIdx) parts.push(text.slice(lastIdx, start));

    const afterMatch = text.slice(m.index + fullMatch.length);
    const wtMatch = afterMatch.match(WT_TAG_RE);
    const worktreeId = wtMatch?.[1] ?? undefined;

    const display = path;
    const isAbsolute = path.startsWith('/');
    const filePath = path.split(':')[0];
    const absPath = isAbsolute ? filePath : PROJECT_ROOT ? `${PROJECT_ROOT}/${filePath}` : null;
    const href = absPath ? `vscode://file${absPath}${line ? `:${line}` : ''}` : null;

    parts.push(
      href ? (
        <FilePathLink
          key={`fp${m.index}`}
          display={display}
          href={href}
          filePath={filePath!}
          line={line ? parseInt(line, 10) : undefined}
          worktreeId={worktreeId}
        />
      ) : (
        <span key={`fp${m.index}`} className="text-blue-400 font-mono text-[0.85em]">
          {display}
        </span>
      ),
    );
    if (wtMatch) {
      lastIdx = m.index + fullMatch.length + wtMatch[0].length;
      combined.lastIndex = lastIdx;
    } else {
      lastIdx = m.index + fullMatch.length;
    }
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length > 0 ? parts : [text];
}

/** F063: File path link — click opens in workspace panel, Cmd/Ctrl+click opens in VSCode */
function FilePathLink({
  display,
  href,
  filePath,
  line,
  worktreeId,
}: {
  display: string;
  href: string;
  filePath: string;
  line?: number;
  worktreeId?: string;
}) {
  const setOpenFile = useChatStore((s) => s.setWorkspaceOpenFile);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      setOpenFile(filePath, line ?? null, worktreeId ?? null);
    },
    [setOpenFile, filePath, line, worktreeId],
  );

  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-[0.85em] cursor-pointer"
      title={`点击在工作区中查看 · Cmd+Click 打开 VSCode\n${display}`}
    >
      {display}
    </a>
  );
}

/** Process string children → @mentions + file path links */
function withMentionsAndLinks(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== 'string') return child;
    const linked = linkifyFilePaths(child);
    return <>{linked.map((node, i) => (typeof node === 'string' ? <span key={i}>{highlightMentions(node)}</span> : node))}</>;
  });
}

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: { className?: string[] };
    hChildren?: Array<{ type: 'text'; value: string }>;
  };
}

const DISPLAY_MATH_WRAPPERS = [
  { open: '[', close: ']' },
  { open: '\\[', close: '\\]' },
  { open: '[[', close: ']]' },
] as const;

function splitDisplayMathPrefix(line: string): { indent: string; blockquotePrefix: string; prefix: string; marker: string } {
  let cursor = 0;
  while (cursor < line.length && /\s/.test(line[cursor]!)) cursor += 1;
  const indent = line.slice(0, cursor);

  let blockquotePrefix = '';
  while (cursor < line.length && line[cursor] === '>') {
    blockquotePrefix += '>';
    cursor += 1;
    if (line[cursor] === ' ') {
      blockquotePrefix += ' ';
      cursor += 1;
    }
  }

  const marker = line.slice(cursor);
  return {
    indent,
    blockquotePrefix,
    prefix: `${indent}${blockquotePrefix}`,
    marker,
  };
}

function getIndentWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    if (char === '\t') {
      const remainder = width % 4;
      width += remainder === 0 ? 4 : 4 - remainder;
      continue;
    }
    width += 1;
  }
  return width;
}

function getMarkerIndentWidth(marker: string): number {
  const leading = marker.match(/^([ \t]*)/)?.[1] ?? '';
  return getIndentWidth(leading);
}

type FenceInfo = {
  marker: '`' | '~';
  length: number;
  trailing: string;
};

function getFenceInfo(marker: string): FenceInfo | null {
  const match = marker.match(/^([ \t]*)(`{3,}|~{3,})(.*)$/);
  if (!match) return null;
  if (getIndentWidth(match[1]) > 3) return null;
  return {
    marker: match[2][0] as '`' | '~',
    length: match[2].length,
    trailing: match[3],
  };
}

function isClosingFence(marker: string, openingFence: FenceInfo): boolean {
  const fence = getFenceInfo(marker);
  if (!fence) return false;
  if (fence.marker !== openingFence.marker) return false;
  if (fence.length < openingFence.length) return false;
  return /^[ \t]*$/.test(fence.trailing);
}

type HtmlBlockInfo = {
  tag?: string;
  kind: 'container' | 'generic' | 'comment' | 'instruction' | 'declaration' | 'cdata';
  terminatesOnBlankLine: boolean;
};

const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const RAW_HTML_CONTAINER_TAGS = new Set(['pre', 'script', 'style', 'textarea']);
const HTML_BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul',
]);
const HTML_OPEN_TAG_RE = /^<([A-Za-z][\w-]*)(?:\s+(?:[^<>"']+|"[^"]*"|'[^']*')*)?\s*\/?>/;
const HTML_STANDALONE_OPEN_TAG_RE = /^<([A-Za-z][\w-]*)(?:\s+(?:[^<>"']+|"[^"]*"|'[^']*')*)?\s*\/?>\s*$/;
const HTML_CLOSE_TAG_RE = /<\/([A-Za-z][\w-]*)\s*>/g;
const HTML_STANDALONE_CLOSE_TAG_RE = /^<\/([A-Za-z][\w-]*)\s*>\s*$/;
const HTML_PARTIAL_OPEN_TAG_RE = /^<([A-Za-z][\w-]*)(?:\s|$)/;

function getHtmlBlockOpenTag(marker: string): HtmlBlockInfo | null {
  if (marker.startsWith('<!--')) {
    return { kind: 'comment', terminatesOnBlankLine: false };
  }
  if (marker.startsWith('<?')) {
    return { kind: 'instruction', terminatesOnBlankLine: false };
  }
  if (marker.startsWith('<![CDATA[')) {
    return { kind: 'cdata', terminatesOnBlankLine: false };
  }
  if (/^<![A-Z]/.test(marker)) {
    return { kind: 'declaration', terminatesOnBlankLine: false };
  }

  const standaloneCloseMatch = marker.match(HTML_STANDALONE_CLOSE_TAG_RE);
  if (standaloneCloseMatch) {
    return {
      kind: 'generic',
      tag: standaloneCloseMatch[1].toLowerCase(),
      terminatesOnBlankLine: true,
    };
  }

  const closeMatch = marker.match(HTML_STANDALONE_CLOSE_TAG_RE);
  if (closeMatch) {
    const tag = closeMatch[1]?.toLowerCase();
    if (!tag || (!RAW_HTML_CONTAINER_TAGS.has(tag) && !HTML_BLOCK_TAGS.has(tag))) return null;
    return {
      kind: 'generic',
      tag,
      terminatesOnBlankLine: true,
    };
  }

  const openMatch = marker.match(HTML_OPEN_TAG_RE);
  if (openMatch) {
    const tag = openMatch[1].toLowerCase();
    const isStandaloneOpenTag = HTML_STANDALONE_OPEN_TAG_RE.test(marker);
    if (!RAW_HTML_CONTAINER_TAGS.has(tag) && !HTML_BLOCK_TAGS.has(tag) && !isStandaloneOpenTag) return null;
    if (VOID_HTML_TAGS.has(tag) && !HTML_BLOCK_TAGS.has(tag) && !isStandaloneOpenTag) return null;
    if (/\/\s*>/.test(openMatch[0])) {
      return {
        kind: 'generic',
        tag,
        terminatesOnBlankLine: true,
      };
    }
    return {
      kind: RAW_HTML_CONTAINER_TAGS.has(tag) ? 'container' : 'generic',
      tag,
      terminatesOnBlankLine: !RAW_HTML_CONTAINER_TAGS.has(tag),
    };
  }

  const partialMatch = marker.match(HTML_PARTIAL_OPEN_TAG_RE);
  if (!partialMatch) return null;
  const tag = partialMatch[1].toLowerCase();
  if (!RAW_HTML_CONTAINER_TAGS.has(tag) && !HTML_BLOCK_TAGS.has(tag)) return null;
  if (VOID_HTML_TAGS.has(tag) && !HTML_BLOCK_TAGS.has(tag)) return null;
  return {
    kind: RAW_HTML_CONTAINER_TAGS.has(tag) ? 'container' : 'generic',
    tag,
    terminatesOnBlankLine: !RAW_HTML_CONTAINER_TAGS.has(tag),
  };
}


function getHtmlBlockCloseTag(marker: string): string | null {
  return [...marker.matchAll(HTML_CLOSE_TAG_RE)].at(-1)?.[1]?.toLowerCase() ?? null;
}

function isHtmlBlockClosed(marker: string, block: HtmlBlockInfo): boolean {
  switch (block.kind) {
    case 'comment':
      return marker.includes('-->');
    case 'instruction':
      return marker.includes('?>');
    case 'declaration':
      return marker.includes('>');
    case 'cdata':
      return marker.includes(']]>');
    case 'container':
      return block.tag != null && [...marker.matchAll(HTML_CLOSE_TAG_RE)].some((match) => match[1]?.toLowerCase() === block.tag);
    case 'generic':
      return false;
  }
}

function getListContentIndent(marker: string, baseIndent: number): number | null {
  const unorderedMatch = marker.match(/^(\s*[-*+]\s+)/);
  if (unorderedMatch) return baseIndent + getIndentWidth(unorderedMatch[1]);

  const orderedMatch = marker.match(/^(\s*\d+[.)]\s+)/);
  if (orderedMatch) return baseIndent + getIndentWidth(orderedMatch[1]);

  return null;
}

function getListContentMarker(marker: string): string {
  const unorderedMatch = marker.match(/^(\s*[-*+]\s+)(.*)$/);
  if (unorderedMatch) return unorderedMatch[2];

  const orderedMatch = marker.match(/^(\s*\d+[.)]\s+)(.*)$/);
  if (orderedMatch) return orderedMatch[2];

  return marker;
}

function getDisplayMathLineContext(line: string) {
  const { indent, blockquotePrefix, prefix, marker } = splitDisplayMathPrefix(line);
  const contentMarker = getListContentMarker(marker);
  const contentPrefix = line.slice(0, line.length - contentMarker.length);
  const listContentIndent = getListContentIndent(marker, getIndentWidth(indent));
  const contentIndentWidth = listContentIndent ?? getIndentWidth(indent) + getMarkerIndentWidth(marker);

  return {
    indent,
    blockquotePrefix,
    prefix,
    marker,
    contentMarker,
    contentPrefix,
    contentIndentWidth,
  };
}

function isIndentedCodeLine(lines: string[], index: number) {
  const { indent, blockquotePrefix, marker } = splitDisplayMathPrefix(lines[index]);
  const indentWidth = getIndentWidth(indent);
  const markerIndentWidth = getMarkerIndentWidth(marker);
  if (indentWidth < 4 && (!blockquotePrefix || markerIndentWidth < 4)) return false;
  if (/^\s*[-*+]\s/.test(marker) || /^\s*\d+[.)]\s/.test(marker)) return false;

  for (let i = index - 1; i >= 0; i -= 1) {
    const previous = splitDisplayMathPrefix(lines[i]);
    if (!previous.marker.trim()) continue;
    if (previous.blockquotePrefix !== blockquotePrefix) return true;

    const previousIndentWidth = getIndentWidth(previous.indent);
    const listContentIndent = getListContentIndent(previous.marker, previousIndentWidth);
    if (listContentIndent != null) {
      return indentWidth >= listContentIndent + 4;
    }

    if (indentWidth >= previousIndentWidth + 4) return true;
    continue;
  }

  return true;
}


function normalizeMathWhitespace(segment: string): string {
  if (!segment.includes('\n')) return segment;
  return segment.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

const NUMBER_SCALAR_RE = /^\d+(?:\.\d+)?$/;
const SINGLE_VAR_RE = /^[A-Za-z]$/;
const GREEK_VAR_RE = /^[Α-Ωα-ω]$/u;
const UPPERCASE_SYMBOL_RE = /^[A-Z]{2}$/;
const COMMON_UPPERCASE_TEXT_RE = /^(?:OK|AI|UI|UX|API|HTTP|HTTPS|URL|USD|EUR|CNY|JPY)$/;
const SIMPLE_FUNCTION_FORM_RE = /^[A-Za-z]\((?:[A-Za-z]|\d+(?:\.\d+)?)(?:\s*,\s*(?:[A-Za-z]|\d+(?:\.\d+)?))*\)$/;
const PARENTHESIZED_EXPR_RE = /^\((?:[A-Za-zΑ-Ωα-ω]|\d+(?:\.\d+)?)(?:\s*[+\-*/,]\s*(?:[A-Za-zΑ-Ωα-ω]|\d+(?:\.\d+)?))*\)$/u;
const SIMPLE_LIST_RE = /^(?:[A-Za-z]|\d+(?:\.\d+)?)(?:\s*,\s*(?:[A-Za-z]|\d+(?:\.\d+)?))+$/;
const SIMPLE_SPACED_LIST_RE = /^(?:[A-Za-z]|\d+(?:\.\d+)?)(?:\s+(?:[A-Za-z]|\d+(?:\.\d+)?))+$/;
const FACTORIAL_RE = /^(?:[A-Za-z]|\d+(?:\.\d+)?|\([^()]+\))!$/;
const OPERATOR_EXPR_RE = /^(?:[A-Za-zΑ-Ωα-ω]|\d+(?:\.\d+)?|\([^()]+\))(?:\s*[+\-*/]\s*(?:[A-Za-zΑ-Ωα-ω]|\d+(?:\.\d+)?|\([^()]+\)))+$/u;
const FUNCTION_CALL_RE = /^(?:sin|cos|tan|cot|sec|csc|log|ln|exp|max|min|sup|inf|det|dim|deg|gcd)\s*(?:[A-Za-z]|\d+(?:\.\d+)?|\([^()]+\))(?:\s*,\s*(?:[A-Za-z]|\d+(?:\.\d+)?|\([^()]+\)))*$/i;
const ENGLISHISH_RE = /^[A-Za-z][A-Za-z,!-]*$/;
const DISPLAY_MATH_COMMAND_RE = /\\[A-Za-z]+/;
const DISPLAY_MATH_GREEK_RE = /[Α-Ωα-ω]/u;
const DISPLAY_MATH_SUPSUB_RE = /(?:^|[\s(])(?:[A-Za-zΑ-Ωα-ω]|\d+(?:\.\d+)?|\))\s*[_^]\s*(?:\{[^{}\n]+\}|[A-Za-zΑ-Ωα-ω0-9()+-]+)(?=$|[\s),.;\]])/u;
const DISPLAY_MATH_ASSIGNMENT_RE = /^(?:[A-Za-z]|[Α-Ωα-ω])(?:\([A-Za-z0-9,+\-\s]+\))?\s*=\s*(?:.*\\[A-Za-z]+.*|.*\d.*|[A-Za-zΑ-Ωα-ω]+\([^)]*\).*)$/u;
const WINDOWS_PATH_RE = /^(?:[A-Za-z]:\\|\\\\)[^\n]+$/;

function looksLikeInlineMath(segment: string): boolean {
  const normalized = normalizeMathWhitespace(segment);
  if (!normalized) return false;

  if (/^\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?)+$/.test(normalized)) return false;
  if (/^\d+(?:\.\d+)?\s+[A-Za-z].*$/.test(normalized)) return false;

  if (/\\[A-Za-z]+/.test(normalized)) return true;
  if (/[=<>_^{}\[\]|]/.test(normalized)) return true;
  if (FUNCTION_CALL_RE.test(normalized)) return true;
  if (SIMPLE_FUNCTION_FORM_RE.test(normalized)) return true;
  if (PARENTHESIZED_EXPR_RE.test(normalized)) return true;
  if (SIMPLE_LIST_RE.test(normalized)) return true;
  if (SIMPLE_SPACED_LIST_RE.test(normalized)) return true;
  if (FACTORIAL_RE.test(normalized)) return true;
  if (OPERATOR_EXPR_RE.test(normalized)) return true;
  if (NUMBER_SCALAR_RE.test(normalized)) return true;
  if (SINGLE_VAR_RE.test(normalized)) return true;
  if (GREEK_VAR_RE.test(normalized)) return true;
  if (UPPERCASE_SYMBOL_RE.test(normalized) && !COMMON_UPPERCASE_TEXT_RE.test(normalized)) return true;

  if (ENGLISHISH_RE.test(normalized)) return false;
  return false;
}

function looksLikeDisplayMath(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) return false;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+$/.test(trimmed)) return false;
  if (WINDOWS_PATH_RE.test(trimmed)) return false;

  const simpleAssignmentMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*([A-Za-z0-9._/-]+)$/);
  if (simpleAssignmentMatch && simpleAssignmentMatch[1].length > 1) return false;
  if (/^[A-Z0-9_]{2,}\s*=\s*[A-Za-z0-9._/-]+$/.test(trimmed)) return false;

  return (
    DISPLAY_MATH_GREEK_RE.test(trimmed) ||
    DISPLAY_MATH_COMMAND_RE.test(trimmed) ||
    DISPLAY_MATH_SUPSUB_RE.test(trimmed) ||
    DISPLAY_MATH_ASSIGNMENT_RE.test(trimmed)
  );
}

function recoverDisplayMath(value: string): string {
  const lines = value.split('\n');
  let changed = false;
  const nextLines: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const wrapper = DISPLAY_MATH_WRAPPERS.find(({ open }) => lines[i].trim() === open);
    if (!wrapper) {
      nextLines.push(lines[i]);
      continue;
    }

    let end = i + 1;
    while (end < lines.length && lines[end].trim() !== wrapper.close) end += 1;
    if (end >= lines.length) {
      nextLines.push(lines[i]);
      continue;
    }

    const bodyLines = lines.slice(i + 1, end);
    const body = bodyLines.join('\n').trim();
    if (!body || !looksLikeDisplayMath(body)) {
      nextLines.push(lines[i]);
      continue;
    }

    const indent = lines[i].match(/^\s*/)?.[0] ?? '';
    nextLines.push(`${indent}$$`, ...bodyLines, `${indent}$$`);
    changed = true;
    i = end;
  }

  return changed ? nextLines.join('\n') : value;
}

function normalizeDisplayMathBlocks(content: string): string {
  const lines = content.split('\n');
  const nextLines: string[] = [];
  let inFence = false;
  let openingFence: FenceInfo | null = null;
  let htmlBlock: HtmlBlockInfo | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineContext = getDisplayMathLineContext(line);
    const { prefix, contentMarker, contentPrefix } = lineContext;

    if (inFence) {
      if (openingFence && isClosingFence(contentMarker, openingFence)) {
        inFence = false;
        openingFence = null;
      }
      nextLines.push(line);
      continue;
    }

    if (htmlBlock) {
      if (!contentMarker.trim() && htmlBlock.terminatesOnBlankLine) {
        htmlBlock = null;
      } else {
        nextLines.push(line);
        if (isHtmlBlockClosed(contentMarker, htmlBlock)) {
          htmlBlock = null;
        }
        continue;
      }
    }

    if (isIndentedCodeLine(lines, i)) {
      nextLines.push(line);
      continue;
    }

    const fenceMatch = getFenceInfo(contentMarker);
    if (fenceMatch) {
      inFence = true;
      openingFence = fenceMatch;
      nextLines.push(line);
      continue;
    }

    const nextHtmlBlock = getHtmlBlockOpenTag(contentMarker);
    if (nextHtmlBlock) {
      htmlBlock = nextHtmlBlock;
      nextLines.push(line);
      if (isHtmlBlockClosed(contentMarker, htmlBlock)) {
        htmlBlock = null;
      }
      continue;
    }

    const wrapper = DISPLAY_MATH_WRAPPERS.find(({ open }) => contentMarker.trim() === open);
    if (!wrapper) {
      nextLines.push(line);
      continue;
    }

    let end = i + 1;
    while (end < lines.length) {
      const endContext = getDisplayMathLineContext(lines[end]);
      if (endContext.blockquotePrefix !== lineContext.blockquotePrefix) break;
      if (endContext.contentIndentWidth < lineContext.contentIndentWidth) break;
      if (endContext.contentIndentWidth === lineContext.contentIndentWidth && endContext.contentMarker.trim() === wrapper.close) break;
      if (getFenceInfo(endContext.contentMarker)) break;
      if (getHtmlBlockOpenTag(endContext.contentMarker) || getHtmlBlockCloseTag(endContext.contentMarker)) break;
      end += 1;
    }
    if (end >= lines.length) {
      nextLines.push(line);
      continue;
    }

    const endContext = getDisplayMathLineContext(lines[end]);
    if (endContext.blockquotePrefix !== lineContext.blockquotePrefix || endContext.contentIndentWidth !== lineContext.contentIndentWidth || endContext.contentMarker.trim() !== wrapper.close) {
      nextLines.push(line);
      continue;
    }

    const bodyContexts = lines.slice(i + 1, end).map(getDisplayMathLineContext);
    const body = bodyContexts.map(({ contentMarker }) => contentMarker).join('\n').trim();
    if (!body || !looksLikeDisplayMath(body)) {
      nextLines.push(line);
      continue;
    }

    nextLines.push(
      `${lineContext.contentPrefix}$$`,
      ...bodyContexts.map(({ contentPrefix: bodyContentPrefix, contentMarker: bodyContentMarker }) => `${bodyContentPrefix}${bodyContentMarker}`),
      `${endContext.contentPrefix}$$`,
    );
    i = end;
  }

  return nextLines.join('\n');
}

function createInlineMathNode(value: string): MarkdownNode {
  return {
    type: 'inlineMath',
    value,
    data: {
      hName: 'code',
      hProperties: { className: ['language-math', 'math-inline'] },
      hChildren: [{ type: 'text', value }],
    },
  };
}

function splitTextIntoInlineMathNodes(value: string): MarkdownNode[] {
  const result: MarkdownNode[] = [];
  let lastIdx = 0;
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf('$', cursor);
    if (start === -1) break;
    if (start > 0 && value[start - 1] === '\\') {
      cursor = start + 1;
      continue;
    }
    if (value[start + 1] === '$') {
      cursor = start + 2;
      continue;
    }

    let end = value.indexOf('$', start + 1);
    while (end !== -1 && (value[end - 1] === '\\' || value[end + 1] === '$')) {
      end = value.indexOf('$', end + 1);
    }
    if (end === -1) break;

    const body = value.slice(start + 1, end);
    if (!looksLikeInlineMath(body)) {
      cursor = start + 1;
      continue;
    }

    if (start > lastIdx) {
      result.push({ type: 'text', value: value.slice(lastIdx, start) });
    }
    result.push(createInlineMathNode(normalizeMathWhitespace(body)));
    lastIdx = end + 1;
    cursor = end + 1;
  }

  if (lastIdx === 0) return [{ type: 'text', value }];
  if (lastIdx < value.length) {
    result.push({ type: 'text', value: value.slice(lastIdx) });
  }
  return result;
}

function remarkRecoverInlineMath() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (!node.children || node.children.length === 0) return;
      const nextChildren: MarkdownNode[] = [];
      for (const child of node.children) {
        if (child.type === 'text' && typeof child.value === 'string') {
          nextChildren.push(...splitTextIntoInlineMathNodes(child.value));
          continue;
        }
        nextChildren.push(child);
        if (child.type === 'inlineCode' || child.type === 'code' || child.type === 'image' || child.type === 'definition' || child.type === 'html') {
          continue;
        }
        visit(child);
      }
      node.children = nextChildren;
    };
    visit(tree);
  };
}

/* ── Markdown component overrides ──────────────────────────── */

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{withMentionsAndLinks(children)}</p>,
  strong: ({ children }) => <strong className="font-semibold">{withMentions(children)}</strong>,
  em: ({ children }) => <em>{withMentions(children)}</em>,
  del: ({ children }) => <del className="opacity-60">{withMentions(children)}</del>,

  h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{withMentions(children)}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{withMentions(children)}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{withMentions(children)}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{withMentions(children)}</h4>,
  h5: ({ children }) => <h5 className="text-xs font-semibold mb-1 mt-1.5 first:mt-0 uppercase tracking-wide">{withMentions(children)}</h5>,
  h6: ({ children }) => <h6 className="text-xs font-medium mb-1 mt-1.5 first:mt-0 text-gray-500">{withMentions(children)}</h6>,

  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children, className }) => (
    <li className={className === 'task-list-item' ? 'list-none -ml-5 flex items-start gap-1.5' : undefined}>{withMentions(children)}</li>
  ),
  input: ({ type, checked }) =>
    type === 'checkbox' ? (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mt-1 h-3.5 w-3.5 rounded border-gray-300 text-blue-500 pointer-events-none"
      />
    ) : (
      <input type={type} />
    ),

  blockquote: ({ children }) => <blockquote className="border-l-[3px] border-cafe pl-3 my-2 italic opacity-80">{children}</blockquote>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
      {withMentions(children)}
    </a>
  ),
  hr: () => <hr className="my-3 border-cafe" />,

  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ className, children }) => (
    <code className={`${className ?? ''} bg-gray-200/50 rounded px-1 py-0.5 text-[0.85em] font-mono`}>{children}</code>
  ),

  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-cafe-surface-elevated">{children}</thead>,
  th: ({ children }) => <th className="border border-cafe px-2 py-1 text-left font-semibold text-xs">{withMentions(children)}</th>,
  td: ({ children }) => <td className="border border-cafe px-2 py-1">{withMentions(children)}</td>,
};

/* ── Exported component ────────────────────────────────────── */
interface Props {
  content: string;
  className?: string;
  disableCommandPrefix?: boolean;
  basePath?: string;
  worktreeId?: string;
}

export function isRelativeMdLink(href: string | undefined): href is string {
  if (!href) return false;
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/')) return false;
  return /\.mdx?(?:#|$)/.test(href);
}

export function resolveRelativePath(base: string, relative: string): string {
  const clean = relative.split('#')[0];
  const parts = base ? base.split('/') : [];
  for (const seg of clean.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

export function MarkdownContent({ content, className, disableCommandPrefix, basePath, worktreeId }: Props) {
  const cmdMatch = disableCommandPrefix ? null : /^(\/\w+)/.exec(content);
  const md = normalizeDisplayMathBlocks(cmdMatch ? content.slice(cmdMatch[1].length) : content);

  let components = mdComponents;
  if (basePath != null) {
    components = { ...components, a: createWorkspaceLinkComponent(basePath, withMentions) };
    if (worktreeId) {
      components = { ...components, img: createWorkspaceImageComponent(basePath, worktreeId) };
    }
  }

  return (
    <div className={`markdown-content text-sm break-words ${className ?? ''}`}>
      {cmdMatch && <span className="font-semibold text-indigo-500">{cmdMatch[1]}</span>}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }], remarkRecoverInlineMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}
