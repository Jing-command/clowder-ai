import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from '@/components/MarkdownContent';

Object.assign(globalThis as Record<string, unknown>, { React });

function render(content: string): string {
  return renderToStaticMarkup(React.createElement(MarkdownContent, { content }));
}

describe('MarkdownContent code block copy button', () => {
  it('renders copy button outside <pre> so textContent is clean', () => {
    const html = render('```js\nconsole.log("hello")\n```');
    expect(html).toContain('<button');
    expect(html).toContain('复制');
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
    expect(preMatch).toBeTruthy();
    expect(preMatch?.[1]).not.toContain('复制');
  });
});

describe('MarkdownContent file path linking', () => {
  it('converts absolute paths to vscode:// links', () => {
    const html = render('See /packages/api/src/routes/messages.ts:42 for details');
    expect(html).toContain('vscode://file/packages/api/src/routes/messages.ts:42');
    expect(html).toContain('text-blue-400');
  });

  it('renders relative paths as styled span when PROJECT_ROOT is not set', () => {
    const html = render('Check packages/web/src/app/page.tsx:10 for the fix');
    expect(html).toContain('packages/web/src/app/page.tsx:10');
    expect(html).not.toContain('vscode://file');
    expect(html).toContain('text-blue-400');
  });
});
