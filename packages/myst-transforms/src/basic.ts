import type { Plugin } from 'unified';
import type { VFile } from 'vfile';
import { liftMystDirectivesAndRolesTransform } from './liftMystDirectivesAndRoles.js';
import { mystTargetsTransform, headingLabelTransform } from './targets.js';
import { captionParagraphTransform } from './caption.js';
import { admonitionBlockquoteTransform, admonitionHeadersTransform } from './admonitions.js';
import { blockMetadataTransform, blockNestingTransform } from './blocks.js';
import { htmlIdsTransform } from './htmlIds.js';
import { imageAltTextTransform } from './images.js';
import { mathLabelTransform, mathNestingTransform } from './math.js';
import { blockquoteTransform } from './blockquote.js';
import { codeBlockToDirectiveTransform } from './code.js';
import type { GenericParent } from 'myst-common';

export function basicTransformations(tree: GenericParent, file: VFile) {
  // lifting roles and directives must happen before the mystTarget transformation
  liftMystDirectivesAndRolesTransform(tree);
  // Some specifics about the ordering are noted below
  captionParagraphTransform(tree);
  codeBlockToDirectiveTransform(tree, file, { translate: ['math', 'mermaid'] });
  mathNestingTransform(tree, file);
  // Math labelling should happen before the target-transformation
  mathLabelTransform(tree, file);
  // Target transformation must happen after lifting the directives, and before the heading labels
  mystTargetsTransform(tree);
  // Label headings after the targets-transform
  headingLabelTransform(tree);
  admonitionBlockquoteTransform(tree); // Must be before header transforms
  admonitionHeadersTransform(tree);
  blockNestingTransform(tree);
  // Block metadata may contain labels/html_ids
  blockMetadataTransform(tree, file);
  htmlIdsTransform(tree);
  imageAltTextTransform(tree);
  blockquoteTransform(tree);
}

export const basicTransformationsPlugin: Plugin<[], GenericParent, GenericParent> =
  () => (tree, file) => {
    basicTransformations(tree, file);
  };
