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

  it('does not repair bracketed math inside raw HTML blocks', () => {
    const html = render('<pre>\n[\nE=mc^2\n]\n</pre>');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;pre&gt;');
    expect(html).toContain('[\nE=mc^2\n]');
    expect(html).toContain('&lt;/pre&gt;');
  });

  it('does not repair bracketed math inside raw HTML comment blocks', () => {
    const html = render('<!--\n[\nx=1\n]\n-->');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;!--');
    expect(html).toContain('[\nx=1\n]');
    expect(html).toContain('--&gt;');
  });

  it('does not repair bracketed math inside raw HTML tags with quoted angle brackets', () => {
    const html = render('<div data-x=\">\">\n[\nx=1\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;div data-x=&quot;&gt;&quot;&gt;');
    expect(html).toContain('[\nx=1\n]');
  });

  it('does not repair bracketed math inside raw HTML container blocks opened inline with nested tags', () => {
    const html = render('<pre language="haskell"><code>\n[\nx=1\n]\n</code></pre>');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;pre language=&quot;haskell&quot;&gt;&lt;code&gt;');
    expect(html).toContain('[\nx=1\n]');
    expect(html).toContain('&lt;/code&gt;&lt;/pre&gt;');
  });

  it('does not repair bracketed math inside raw HTML container blocks with multiline openers', () => {
    const html = render('<style\n  type="text/css">\n[\nx=1\n]\n</style>');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;style');
    expect(html).toContain('type=&quot;text/css&quot;');
    expect(html).toContain('[\nx=1\n]');
    expect(html).toContain('&lt;/style&gt;');
  });

  it('repairs blockquote display math after non-block partial tags', () => {
    const html = render('<span\nclass="x">\n> [\n> x=1\n> ]');
    expect(html).toContain('&lt;span');
    expect(html).toContain('class=&quot;x&quot;&gt;');
    expect(html).toContain('<blockquote');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
  });

  it('does not repair bracketed math after void raw HTML block openers', () => {
    const html = render('<hr>\n[\nx=1\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;hr&gt;');
    expect(html).toContain('[\nx=1\n]');
  });

  it('does not repair bracketed math inside raw HTML blocks opened within list items', () => {
    const html = render('- <div>\n  [\n  x=1\n  ]');
    expect(html).not.toContain('katex');
    expect(html).toContain('<li>');
    expect(html).toContain('&lt;div&gt;');
    expect(html).toContain('[\nx=1\n]');
    expect(html).toContain('</li>');
  });

  it('repairs bracketed math after generic raw HTML blocks end at a blank line', () => {
    const html = render('<div>\nraw html\n\n[\nx=1\n]');
    expect(html).toContain('&lt;div&gt;');
    expect(html).toContain('raw html');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
  });

  it('does not repair bracketed math inside generic raw HTML blocks opened with same-line text', () => {
    const html = render('<div>raw html\n[\nx=1\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;div&gt;raw html');
    expect(html).toContain('[\nx=1\n]');
  });

  it('does not repair bracketed math inside standalone inline HTML tag blocks', () => {
    const html = render('<i class="foo">\n[\nx=1\n]\n</i>');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;i class=&quot;foo&quot;&gt;');
    expect(html).toContain('[\nx=1\n]');
    expect(html).toContain('&lt;/i&gt;');
  });

  it('does not repair bracketed math inside standalone void HTML tag blocks', () => {
    const html = render('<img src="x">\n[\nx=1\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;img src=&quot;x&quot;&gt;');
    expect(html).toContain('[\nx=1\n]');
  });

  it('does not repair bracketed math after standalone inline closing tags', () => {
    const html = render('</ins>\n[\nx=1\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('&lt;/ins&gt;');
    expect(html).toContain('[\nx=1\n]');
  });

  it('repairs bracketed math after inline non-block HTML tags', () => {
    const html = render('<span>raw html\n[\nx=1\n]\nfoo</span>\n\n[\ny=2\n]');
    expect(html).toContain('&lt;span&gt;');
    expect(html).toContain('<span>raw html</span>');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('<span>foo</span>');
    expect(html).toContain('&lt;/span&gt;');
    expect(html).toContain('annotation encoding="application/x-tex">y=2</annotation>');
  });

  it('repairs bracketed math after inline closing-tag text', () => {
    const html = render('foo</div>\n[\nx=1\n]');
    expect(html).toContain('<span>foo</span>');
    expect(html).toContain('<span>&lt;/div&gt;</span>');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
  });

  it('repairs bracketed math after inline-closing raw HTML container blocks', () => {
    const html = render('<pre>\n[\nx=1\n]\nfoo</pre>\n\n[\ny=2\n]');
    expect(html).not.toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('[\nx=1\n]');
    expect(html).toContain('annotation encoding="application/x-tex">y=2</annotation>');
  });

  it('repairs bracketed math after nested inline-closing raw HTML container tags', () => {
    const html = render('<pre language="haskell"><code>\n[\nx=1\n]\n</code></pre>\n\n[\ny=2\n]');
    expect(html).not.toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('&lt;/code&gt;&lt;/pre&gt;');
    expect(html).toContain('annotation encoding="application/x-tex">y=2</annotation>');
  });

  it('renders inline math inside link labels', () => {
    const html = render('[$x$](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('katex');
    expect(html).toContain('annotation encoding="application/x-tex">x</annotation>');
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

  it('repairs bracket-wrapped display math', () => {
    const html = render('[\nI(t)=\\operatorname{sinc}(10^3 t)\n]');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">I(t)=\\operatorname{sinc}(10^3 t)</annotation>');
  });

  it('repairs simple variable equations', () => {
    const html = render('[\nE=mc^2\n]');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">E=mc^2</annotation>');
  });

  it('repairs numeric assignments that are math equations', () => {
    const html = render('[\nx=1\n]');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
  });

  it('repairs aligned LaTeX display math', () => {
    const html = render('[\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n]');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">\\begin{aligned}\na &amp;= b \\\\\nc &amp;= d\n\\end{aligned}</annotation>');
  });

  it('repairs escaped-bracket display math', () => {
    const html = render('\\[\nQ(t)=3\\operatorname{sinc}(10^3 t)\n\\]');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">Q(t)=3\\operatorname{sinc}(10^3 t)</annotation>');
  });

  it('repairs double-bracket display math', () => {
    const html = render('[[\nα+β=γ\n]]');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">α+β=γ</annotation>');
  });

  it('does not repair bracketed plain English blocks', () => {
    const html = render('[\nhello world\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('<span>[</span>');
    expect(html).toContain('<span>hello world</span>');
    expect(html).toContain('<span>]</span>');
  });

  it('does not repair bracketed formulas inside fenced code', () => {
    const html = render('```tex\n[\nE=mc^2\n]\n```');
    expect(html).not.toContain('katex');
    expect(html).toContain('[\nE=mc^2\n]');
  });

  it('does not affect markdown links with brackets', () => {
    const html = render('[docs](https://example.com)');
    expect(html).not.toContain('katex');
    expect(html).toContain('href="https://example.com"');
  });

  it('does not repair bracketed config assignments', () => {
    const html = render('[\nkey=value\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('<span>key=value</span>');
  });

  it('does not repair bracketed env-style assignments', () => {
    const html = render('[\nAPI_KEY=value\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('<span>API_KEY=value</span>');
  });

  it('does not repair bracketed file paths', () => {
    const html = render('[\npath/to_file\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('<span>path/to_file</span>');
  });

  it('does not repair bracketed JSON blocks', () => {
    const html = render('[\n{\n  "a": 1\n}\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('<span>{</span>');
    expect(html).toContain('<span>&quot;a&quot;: 1</span>');
    expect(html).toContain('<span>}</span>');
  });

  it('does not repair bracketed caret-heavy technical text', () => {
    const html = render('[\ncache^key\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('<span>cache^key</span>');
  });

  it('repairs blockquote-wrapped display math', () => {
    const html = render('> [\n> I(t)=\\operatorname{sinc}(10^3 t)\n> ]');
    expect(html).toContain('<blockquote');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">I(t)=\\operatorname{sinc}(10^3 t)</annotation>');
    expect(html).toContain('</blockquote>');
  });

  it('repairs unordered-list display math without breaking the list', () => {
    const html = render('- step\n  [\n  E=mc^2\n  ]');
    expect(html).toContain('<ul class="list-disc pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>step');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">E=mc^2</annotation>');
    expect(html).toContain('</li>');
    expect(html).toContain('</ul>');
  });

  it('repairs ordered-list display math without breaking the list', () => {
    const html = render('1. step\n   [\n   x=1\n   ]');
    expect(html).toContain('<ol class="list-decimal pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>step');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('</li>');
    expect(html).toContain('</ol>');
  });

  it('repairs multi-digit ordered-list display math without breaking the list', () => {
    const html = render('10. step\n    [\n    x=1\n    ]');
    expect(html).toContain('<ol class="list-decimal pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>step');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('</li>');
    expect(html).toContain('</ol>');
  });

  it('repairs unordered-list display math in a blank-line continuation paragraph', () => {
    const html = render('- item\n\n    [\n    x=1\n    ]');
    expect(html).toContain('<ul class="list-disc pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>');
    expect(html).toContain('<p class="mb-2 last:mb-0 leading-relaxed"><span>item</span></p>');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('</li>');
  });

  it('keeps unordered-list indented code blocks as literal text after a blank line', () => {
    const html = render('- item\n\n      [\n      x=1\n      ]');
    expect(html).not.toContain('katex');
    expect(html).toContain('[\nx=1\n]');
  });

  it('repairs ordered-list display math in a blank-line continuation paragraph', () => {
    const html = render('1. item\n\n     [\n     x=1\n     ]');
    expect(html).toContain('<ol class="list-decimal pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>');
    expect(html).toContain('<p class="mb-2 last:mb-0 leading-relaxed"><span>item</span></p>');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('</li>');
  });

  it('keeps ordered-list indented code blocks as literal text after a blank line', () => {
    const html = render('1. item\n\n       [\n       x=1\n       ]');
    expect(html).not.toContain('katex');
    expect(html).toContain('[\nx=1\n]');
  });

  it('repairs unordered-list display math after continuation text in a blank-line paragraph', () => {
    const html = render('- item\n\n    continuation\n\n    [\n    x=1\n    ]');
    expect(html).toContain('<ul class="list-disc pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>');
    expect(html).toContain('<span>continuation</span>');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('</li>');
  });

  it('repairs ordered-list display math after continuation text in a blank-line paragraph', () => {
    const html = render('1. item\n\n     continuation\n\n     [\n     x=1\n     ]');
    expect(html).toContain('<ol class="list-decimal pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>');
    expect(html).toContain('<span>continuation</span>');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('</li>');
  });

  it('repairs nested unordered-list display math', () => {
    const html = render('- outer\n  - inner\n    [\n    E=mc^2\n    ]');
    expect(html).toContain('<ul class="list-disc pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>outer');
    expect(html).toContain('<li>inner');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">E=mc^2</annotation>');
  });

  it('repairs display math when the body is more indented than the opener', () => {
    const html = render('[\n  x=1\n]');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">  x=1</annotation>');
  });

  it('repairs list-item display math when the item starts with the opener', () => {
    const html = render('- [\n  x=1\n  ]');
    expect(html).toContain('<ul class="list-disc pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('</li>');
  });

  it('repairs blockquote list-item display math without dropping the list structure', () => {
    const html = render('> - [\n>   x=1\n>   ]');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<ul class="list-disc pl-5 mb-2 space-y-0.5">');
    expect(html).toContain('<li>');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
    expect(html).toContain('</li>');
    expect(html).toContain('</blockquote>');
  });

  it('does not repair bracketed Windows paths', () => {
    const html = render('[\nC:\\Users\\adam\\notes\n]');
    expect(html).not.toContain('katex');
    expect(html).toContain('<span>C:\\Users\\adam\\notes</span>');
  });


  it('keeps blockquote-indented code blocks as literal text', () => {
    const html = render('>     [\n>     E=mc^2\n>     ]');
    expect(html).not.toContain('katex');
    expect(html).toContain('[\nE=mc^2\n]');
  });

  it('keeps blockquote-fenced code blocks as literal text', () => {
    const html = render('> ```tex\n> [\n> E=mc^2\n> ]\n> ```');
    expect(html).not.toContain('katex');
    expect(html).toContain('[\nE=mc^2\n]');
  });

  it('keeps tab-indented code blocks as literal text', () => {
    const html = render('\t[\n\tE=mc^2\n\t]');
    expect(html).not.toContain('katex');
    expect(html).toContain('[\nE=mc^2\n]');
  });

  it('repairs display math after a plain indented literal fence opener', () => {
    const html = render('    ```not a fence\n\n[\nx=1\n]');
    expect(html).toContain('```not a fence');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
  });

  it('repairs display math after a plain indented literal HTML opener', () => {
    const html = render('    <!-- not html block\n\n[\ny=2\n]');
    expect(html).toContain('&lt;!-- not html block');
    expect(html).toContain('katex-display');
    expect(html).toContain('annotation encoding="application/x-tex">y=2</annotation>');
  });

  it('repairs math after blockquote fences closed by a longer marker', () => {
    const html = render('> ```tex\n> [\n> E=mc^2\n> ]\n> ````\n\n[\nx=1\n]');
    expect(html).toContain('[\nE=mc^2\n]');
    expect(html).toContain('annotation encoding="application/x-tex">x=1</annotation>');
  });

  it('keeps fence-like code lines inside blockquote fences as literal text', () => {
    const html = render('> ```md\n> ```not closing\n> [\n> E=mc^2\n> ]\n> ```');
    expect(html).not.toContain('katex');
    expect(html).toContain('```not closing\n[\nE=mc^2\n]');
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
