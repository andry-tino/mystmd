import type { Code } from 'myst-spec';
import { fileError, toText } from 'myst-common';
import type { ITexSerializer, StateData } from './types.js';
import { getClasses, getLatexImageWidth, hrefToLatexText } from './utils.js';

export function text(node: any, state: ITexSerializer<StateData>) {
  state.text(node.value);
}

export function paragraph(node: any, state: ITexSerializer<StateData>) {
  state.renderChildren(node);
}

export function heading(node: any, state: ITexSerializer<StateData>) {
  const { depth, label, enumerated } = node;
  if (state.data.nextHeadingIsFrameTitle) {
    state.write('\\frametitle{');
    state.data.nextHeadingIsFrameTitle = false;
  } else {
    const star = enumerated !== false || state.options.beamer ? '' : '*';
    if (depth === 1) state.write(`\\section${star}{`);
    if (depth === 2) state.write(`\\subsection${star}{`);
    if (depth === 3) state.write(`\\subsubsection${star}{`);
    if (depth === 4) state.write(`\\paragraph${star}{`);
    if (depth === 5) state.write(`\\subparagraph${star}{`);
    if (depth === 6) state.write(`\\subparagraph${star}{`);
  }
  state.renderChildren(node, true);
  state.write('}');
  if (enumerated !== false && label) {
    state.write(`\\label{${label}}`);
  }
  state.closeBlock(node);
}

export function block(node: any, state: ITexSerializer<StateData>) {
  if (state.options.beamer) {
    // Metadata from block `+++ { "outline": true }` is put in data field.
    if (node.data?.outline) {
      // For beamer blocks that are outline, write the content as normal
      // This will hopefully just be section and subsection
      state.data.nextHeadingIsFrameTitle = false;
      state.renderChildren(node, false);
      return;
    }
    if (node.children?.[0]?.type === 'heading') {
      state.data.nextHeadingIsFrameTitle = true;
    }
    state.write('\n\n\\begin{frame}\n');
    state.renderChildren(node, false);
    state.write('\\end{frame}\n\n');
    return;
  }
  state.renderChildren(node, false);
}

export function blockquote(node: any, state: ITexSerializer<StateData>) {
  state.renderEnvironment(node, 'quote');
}

export function definitionList(node: any, state: ITexSerializer<StateData>) {
  state.write('\\begin{description}\n');
  state.renderChildren(node, true);
  state.ensureNewLine();
  state.write('\\end{description}');
  state.closeBlock(node);
}

export function definitionTerm(node: any, state: ITexSerializer<StateData>) {
  state.ensureNewLine();
  state.write('\\item[');
  state.renderChildren(node, true);
  state.write('] ');
}

export function definitionDescription(node: any, state: ITexSerializer<StateData>) {
  state.renderChildren(node, true);
}

export function code(node: Code, state: ITexSerializer<StateData>) {
  let start = '\\begin{verbatim}\n';
  let end = '\n\\end{verbatim}';

  if (getClasses(node.class).includes('listings') && node.lang !== undefined) {
    state.usePackages('listings');
    start = `\\begin{lstlisting}[language=${node.lang}]\n`;
    end = '\n\\end{lstlisting}';
  } else if (getClasses(node.class).includes('minted') && node.lang !== undefined) {
    state.usePackages('minted');
    start = `\\begin{minted}{${node.lang}}\n`;
    end = '\n\\end{minted}';
  }
  state.write(start);
  state.text(node.value, true);
  state.write(end);
  state.closeBlock(node);
}

export function list(node: any, state: ITexSerializer<StateData>) {
  if (state.data.isInTable) {
    node.children.forEach((child: any, i: number) => {
      state.write(node.ordered ? `${i}.~~` : '\\textbullet~~');
      state.renderChildren(child, true);
      state.write('\\newline');
      state.ensureNewLine();
    });
  } else {
    state.renderEnvironment(node, node.ordered ? 'enumerate' : 'itemize', {
      parameters: node.ordered && node.start !== 1 ? 'resume' : undefined,
    });
  }
}

export function listItem(node: any, state: ITexSerializer<StateData>) {
  state.write('\\item ');
  state.renderChildren(node, true);
  state.write('\n');
}

export function thematicBreak(node: any, state: ITexSerializer<StateData>) {
  state.write('\n\\bigskip\n\\centerline{\\rule{13cm}{0.4pt}}\n\\bigskip');
  state.closeBlock(node);
}

export function mystRole(node: any, state: ITexSerializer<StateData>) {
  state.renderChildren(node, true);
}

export function mystDirective(node: any, state: ITexSerializer<StateData>) {
  state.renderChildren(node, false);
}

export function comment(node: any, state: ITexSerializer<StateData>) {
  state.ensureNewLine();
  state.write(`% ${node.value?.split('\n').join('\n% ') ?? ''}`);
  state.closeBlock(node);
}

export function strong(node: any, state: ITexSerializer<StateData>) {
  state.renderInlineEnvironment(node, 'textbf');
}

export function emphasis(node: any, state: ITexSerializer<StateData>) {
  state.renderInlineEnvironment(node, 'textit');
}

export function underline(node: any, state: ITexSerializer<StateData>) {
  state.renderInlineEnvironment(node, 'uline');
}

export function inlineCode(node: any, state: ITexSerializer<StateData>) {
  state.write('\\texttt{');
  state.text(node.value, false);
  state.write('}');
}

export function subscript(node: any, state: ITexSerializer<StateData>) {
  state.renderInlineEnvironment(node, 'textsubscript');
}

export function superscript(node: any, state: ITexSerializer<StateData>) {
  state.renderInlineEnvironment(node, 'textsuperscript');
}

export function delete_(node: any, state: ITexSerializer<StateData>) {
  // \usepackage[normalem]{ulem}
  state.usePackages('ulem');
  state.renderInlineEnvironment(node, 'sout');
}

export function break_(node: any, state: ITexSerializer<StateData>) {
  // Use \newline instead of `\\` for breaks in LaTeX, it works in all phrasing contexts.
  // `\\` is used in tables to denote a new row.
  state.write('\\newline');
  state.ensureNewLine();
}

export function abbreviation(node: any, state: ITexSerializer<StateData>) {
  // TODO: \newacronym{gcd}{GCD}{Greatest Common Divisor}
  // https://www.overleaf.com/learn/latex/glossaries
  state.renderChildren(node, true);
}

export function glossary(node: any, state: ITexSerializer<StateData>) {
  state.usePackages('glossaries');
  console.log('GLOSSARY', JSON.stringify(node));
  state.write('stuff');
}

export function link(node: any, state: ITexSerializer<StateData>) {
  state.usePackages('url', 'hyperref');
  const href = node.url;
  if (node.children[0]?.value === href) {
    // URL is the same
    state.write('\\url{');
    state.write(hrefToLatexText(href));
    state.write('}');
    return;
  }
  state.write('\\href{');
  state.write(hrefToLatexText(href));
  state.write('}{');
  state.renderChildren(node, true);
  state.write('}');
}

export function admonition(node: any, state: ITexSerializer<StateData>) {
  state.usePackages('framed');
  state.renderEnvironment(node, 'framed');
}

export function admonitionTitle(node: any, state: ITexSerializer<StateData>) {
  state.renderInlineEnvironment(node, 'textbf');
  state.write('\\\\\n');
}

export function image(node: any, state: ITexSerializer<StateData>) {
  state.usePackages('graphicx');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { width: nodeWidth, url: nodeSrc, align } = node;
  const src = nodeSrc;
  const width = getLatexImageWidth(nodeWidth);
  //   let align = 'center';
  //   switch (nodeAlign?.toLowerCase()) {
  //     case 'left':
  //       align = 'flushleft';
  //       break;
  //     case 'right':
  //       align = 'flushright';
  //       break;
  //     default:
  //       break;
  //   }
  //   if (!caption) {
  //     const template = `
  // \\begin{${align}}
  //   \\includegraphics[width=${width / 100}\\linewidth]{${src}}
  // \\end{${align}}\n`;
  //     state.write(template);
  //     return;
  //   }
  state.write(`\\includegraphics[width=${width}]{${src}}`);
  state.closeBlock(node);
}

export function crossReference(node: any, state: ITexSerializer<StateData>) {
  // Look up reference and add the text
  const usedTemplate = node.template?.includes('%s') ? node.template : undefined;
  const text = (usedTemplate ?? toText(node))?.replace(/\s/g, '~') || '%s';
  const id = node.label;
  state.write(text.replace(/%s/g, `\\ref{${id}}`));
}

export function citeGroup(node: any, state: ITexSerializer<StateData>) {
  if (state.options.citestyle === 'numerical-only') {
    state.write('\\cite{');
  } else if (state.options.bibliography === 'biblatex') {
    const command = node.kind === 'narrative' ? 'textcite' : 'parencite';
    state.write(`\\${command}{`);
  } else {
    const tp = node.kind === 'narrative' ? 't' : 'p';
    state.write(`\\cite${tp}{`);
  }
  state.renderChildren(node, true, ', ');
  state.write('}');
}

export function cite(node: any, state: ITexSerializer<StateData>, parent: any) {
  if (!state.options.bibliography) {
    state.usePackages('natbib');
    // Don't include biblatex in the package list
  }
  if (parent.type === 'citeGroup') {
    state.write(node.label);
  } else if (state.options.bibliography === 'biblatex') {
    state.write(`\\textcite{${node.label}}`);
  } else {
    state.write(`\\cite{${node.label}}`);
  }
}

export function embed(node: any, state: ITexSerializer<StateData>) {
  state.renderChildren(node, true);
}

export function include(node: any, state: ITexSerializer<StateData>) {
  state.renderChildren(node, true);
}

export function footnoteReference(node: any, state: ITexSerializer<StateData>) {
  if (!node.identifier) return;
  const footnote = state.footnotes[node.identifier];
  if (!footnote) {
    fileError(state.file, `Unknown footnote identifier "${node.identifier}"`, {
      node,
      source: 'myst-to-tex',
    });
    return;
  }
  state.write('\\footnote{');
  state.renderChildren(footnote, true);
  state.trimEnd();
  state.write('}');
}

export function footnoteDefinition() {
  // Nothing!
}

export function si(node: any, state: ITexSerializer<StateData>) {
  state.usePackages('siunitx');
  if (node.number == null) {
    state.write(`\\unit{${node.units?.map((u: string) => `\\${u}`).join('') ?? ''}}`);
  } else {
    state.write(
      `\\qty{${node.number}}{${node.units?.map((u: string) => `\\${u}`).join('') ?? ''}}`,
    );
  }
}
