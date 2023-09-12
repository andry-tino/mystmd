import type { Root, Parent } from 'myst-spec';
import type { Plugin } from 'unified';
import type { VFile } from 'vfile';
import type { References } from 'myst-common';
import { fileError } from 'myst-common';
import { captionHandler, containerHandler } from './container.js';
import { renderNodeToLatex } from './tables.js';
import type { Handler, ITexSerializer, LatexResult, Options, StateData } from './types.js';
import { stringToLatexMath, stringToLatexText } from './utils.js';
import MATH_HANDLERS, { withRecursiveCommands } from './math.js';
import { selectAll } from 'unist-util-select';
import type { FootnoteDefinition } from 'myst-spec-ext';
import { transformLegends } from './legends.js';
import {
  abbreviation,
  admonition,
  admonitionTitle,
  block,
  blockquote,
  break_,
  cite,
  citeGroup,
  code,
  comment,
  crossReference,
  definitionDescription,
  definitionList,
  definitionTerm,
  delete_,
  embed,
  emphasis,
  footnoteReference,
  glossary,
  heading,
  image,
  include,
  inlineCode,
  link,
  list,
  listItem,
  mystDirective,
  mystRole,
  paragraph,
  si,
  strong,
  subscript,
  superscript,
  text,
  thematicBreak,
  underline,
} from './handlers.js';

export type { LatexResult } from './types.js';

const handlers: Record<string, Handler> = {
  text,
  paragraph,
  heading,
  block,
  blockquote,
  definitionList,
  definitionTerm,
  definitionDescription,
  code,
  list,
  listItem,
  thematicBreak,
  ...MATH_HANDLERS,
  mystRole,
  mystDirective,
  comment,
  strong,
  emphasis,
  underline,
  inlineCode,
  subscript,
  superscript,
  delete: delete_,
  break: break_,
  abbreviation,
  glossary,
  link,
  admonition,
  admonitionTitle,
  table: renderNodeToLatex,
  image,
  container: containerHandler,
  caption: captionHandler,
  captionNumber: () => undefined,
  crossReference,
  citeGroup,
  cite,
  embed,
  include,
  footnoteReference,
  footnoteDefinition() {
    // Nothing!
  },
  si,
};

class TexSerializer implements ITexSerializer {
  file: VFile;
  data: StateData;
  options: Options;
  handlers: Record<string, Handler>;
  references: References;
  footnotes: Record<string, FootnoteDefinition>;

  constructor(file: VFile, tree: Root, opts?: Options) {
    file.result = '';
    this.file = file;
    this.options = opts ?? {};
    this.data = { mathPlugins: {}, imports: new Set() };
    this.handlers = opts?.handlers ?? handlers;
    this.references = opts?.references ?? {};
    this.footnotes = Object.fromEntries(
      selectAll('footnoteDefinition', tree).map((node) => {
        const fn = node as FootnoteDefinition;
        return [fn.identifier, fn];
      }),
    );
    this.renderChildren(tree);
  }

  get out(): string {
    return this.file.result as string;
  }

  usePackages(...packageNames: string[]) {
    packageNames.forEach((p) => {
      this.data.imports.add(p);
    });
  }

  write(value: string) {
    this.file.result += value;
  }

  text(value: string, mathMode = false) {
    const escaped = mathMode ? stringToLatexMath(value) : stringToLatexText(value);
    this.write(escaped);
  }

  trimEnd() {
    this.file.result = this.out.trimEnd();
  }

  ensureNewLine(trim = false) {
    if (trim) this.trimEnd();
    if (this.out.endsWith('\n')) return;
    this.write('\n');
  }

  renderChildren(node: Partial<Parent>, inline = false, delim = '') {
    const numChildren = node.children?.length ?? 0;
    node.children?.forEach((child, index) => {
      const handler = this.handlers[child.type];
      if (handler) {
        handler(child, this, node);
      } else {
        fileError(this.file, `Unhandled LaTeX conversion for node of "${child.type}"`, {
          node: child,
          source: 'myst-to-tex',
        });
      }
      if (delim && index + 1 < numChildren) this.write(delim);
    });
    if (!inline) this.closeBlock(node);
  }

  renderEnvironment(node: any, env: string, opts?: { parameters?: string; arguments?: string[] }) {
    const optsInBrackets = opts?.parameters ? `[${opts.parameters}]` : '';
    const optsInBraces = opts?.arguments ? `{${opts.arguments.join('}{')}}` : '';
    this.file.result += `\\begin{${env}}${optsInBrackets}${optsInBraces}\n`;
    this.renderChildren(node, true);
    this.ensureNewLine(true);
    this.file.result += `\\end{${env}}`;
    this.closeBlock(node);
  }

  renderInlineEnvironment(node: any, env: string, opts?: { after?: string }) {
    this.file.result += `\\${env}{`;
    this.renderChildren(node, true);
    this.trimEnd();
    this.file.result += '}';
    if (opts?.after) {
      this.ensureNewLine(true);
      this.write(opts.after);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  closeBlock(node: any) {
    this.ensureNewLine(true);
    this.file.result += '\n';
  }
}

const plugin: Plugin<[Options?], Root, VFile> = function (opts) {
  this.Compiler = (node, file) => {
    transformLegends(node);
    const state = new TexSerializer(file, node, opts ?? { handlers });
    const tex = (file.result as string).trim();
    const result: LatexResult = {
      imports: [...state.data.imports],
      commands: withRecursiveCommands(state),
      value: tex,
    };
    file.result = result;
    return file;
  };

  return (node: Root) => {
    // Preprocess
    return node;
  };
};

export default plugin;
