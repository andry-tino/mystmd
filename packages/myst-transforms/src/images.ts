import type { Plugin } from 'unified';
import type { Container, Paragraph, PhrasingContent, Image } from 'myst-spec';
import { select, selectAll } from 'unist-util-select';
import type { GenericParent } from 'myst-common';
import { toText } from 'myst-common';

export function imageAltTextTransform(tree: GenericParent) {
  const containers = selectAll('container', tree) as Container[];
  containers.forEach((container) => {
    const image = select('image', container) as Image;
    if (!image || image.alt) return;
    const para = select('caption > paragraph', container) as Paragraph;
    if (!para) return;
    // Get rid of the captionNumber
    const content = para.children?.filter((n) => (n.type as string) !== 'captionNumber');
    if (!content || content.length < 1) return;
    image.alt = toText(content as PhrasingContent[]);
  });
}

export const imageAltTextPlugin: Plugin<[], GenericParent, GenericParent> = () => (tree) => {
  imageAltTextTransform(tree);
};
