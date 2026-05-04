import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from '@/components/MarkdownContent';

Object.assign(globalThis as Record<string, unknown>, { React });

function render(content: string): string {
  return renderToStaticMarkup(React.createElement(MarkdownContent, { content, disableCommandPrefix: true }));
}

describe('MarkdownContent math rendering', () => {
  it('renders inline math with katex markup', () => {
    const html = render('Inline $x^2 + y^2$ example');
    expect(html).toContain('katex');
    expect(html).toContain('x');
    expect(html).toContain('y');
  });

  it('renders block math with display markup', () => {
    const html = render('\n\n$$\n\\tilde{x}(t) = I(t) + j Q(t)\n$$\n\n');
    expect(html).toContain('katex-display');
    expect(html).toContain('tilde');
  });

  it('renders malformed line-broken inline math after normalization', () => {
    const html = render('$\\tilde{x}(t) = I(t) + j\nQ(t)$');
    expect(html).toContain('katex');
    expect(html).toContain('tilde');
    expect(html).toContain('Q');
  });

  it('does not parse currency text as math', () => {
    const html = render('Price is $5 and $10 today');
    expect(html).not.toContain('katex');
    expect(html).toContain('Price is $5 and $10 today');
  });

  it('keeps later inline math after currency text', () => {
    const html = render('Pay $5 and solve $x$');
    expect(html).toContain('Pay $5 and solve ');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">x</annotation>');
  });

  it('does not parse currency ranges as math', () => {
    const html = render('Price range $5-$10 today');
    expect(html).not.toContain('katex');
    expect(html).toContain('Price range $5-$10 today');
  });

  it('keeps later inline math after a currency range', () => {
    const html = render('Price range $5-$10 and solve $x$');
    expect(html).toContain('Price range $5-$10 and solve ');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">x</annotation>');
  });

  it('renders comma-separated inline math', () => {
    const html = render('$x,y$');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">x,y</annotation>');
  });

  it('does not parse plain English phrases as math', () => {
    const html = render('$hello world$');
    expect(html).not.toContain('katex');
    expect(html).toContain('$hello world$');
  });

  it('renders function-style inline math with spaces', () => {
    const html = render('$sin x$');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">sin x</annotation>');
  });

  it('does not parse punctuation-joined English as math', () => {
    const html = render('$hello,world$');
    expect(html).not.toContain('katex');
    expect(html).toContain('$hello,world$');
  });

  it('does not parse emphatic English as math', () => {
    const html = render('$wow!$');
    expect(html).not.toContain('katex');
    expect(html).toContain('$wow!$');
  });

  it('does not parse hyphenated English as math', () => {
    const html = render('$foo-bar$');
    expect(html).not.toContain('katex');
    expect(html).toContain('$foo-bar$');
  });

  it('does not parse short English words as math', () => {
    const html = render('$ok$');
    expect(html).not.toContain('katex');
    expect(html).toContain('$ok$');
  });

  it('renders function-form inline math', () => {
    const html = render('$f(x)$');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">f(x)</annotation>');
  });

  it('renders uppercase multi-letter inline math', () => {
    const html = render('$AB$');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">AB</annotation>');
  });

  it('does not parse uppercase English words as math', () => {
    const html = render('$OK$ and $USD$');
    expect(html).not.toContain('katex');
    expect(html).toContain('$OK$ and $USD$');
  });

  it('renders numeric scalar inline math', () => {
    const html = render('$2$');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">2</annotation>');
  });

  it('renders numeric-only inline math', () => {
    const html = render('$1+2$');
    expect(html).toContain('katex');
    expect(html).toContain('1');
    expect(html).toContain('2');
  });

  it('renders parenthesized inline math', () => {
    const html = render('$(x)$');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">(x)</annotation>');
  });

  it('renders parenthesized inline expressions', () => {
    const html = render('$(x+1)$');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">(x+1)</annotation>');
  });

  it('renders greek-symbol inline math', () => {
    const html = render('$α+β$');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">α+β</annotation>');
  });

  it('keeps inline code as literal text instead of rendering math', () => {
    const html = render('`$x^2$`');
    expect(html).not.toContain('katex');
    expect(html).toContain('$x^2$');
  });

  it('keeps fenced code as literal text instead of rendering math', () => {
    const html = render('```tex\n$x^2$\n```');
    expect(html).not.toContain('katex');
    expect(html).toContain('$x^2$');
  });

  it('keeps tilde fenced code as literal text instead of rendering math', () => {
    const html = render('~~~tex\n$x^2$\n~~~');
    expect(html).not.toContain('katex');
    expect(html).toContain('$x^2$');
  });

  it('keeps indented code block as literal text instead of rendering math', () => {
    const html = render('    $a\n    +b$');
    expect(html).not.toContain('katex');
    expect(html).toContain('$a');
    expect(html).toContain('+b$');
  });
});
