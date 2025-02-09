import type { Cite, CiteGroup, CiteKind } from 'myst-spec-ext';
import type { RoleSpec, RoleData } from 'myst-common';
import { normalizeLabel } from 'myst-common';

export const citeRole: RoleSpec = {
  name: 'cite',
  alias: [
    'cite:p',
    'cite:t',
    // https://sphinxcontrib-bibtex.readthedocs.io/en/latest/usage.html
    'cite:ps',
    'cite:ts',
    'cite:ct',
    'cite:cts',
    'cite:alp',
    'cite:alps',
    'cite:label',
    'cite:labelpar',
    'cite:year',
    'cite:yearpar',
    'cite:author',
    'cite:authors',
    'cite:authorpar',
    'cite:authorpars',
    'cite:cauthor',
    'cite:cauthors',
    // 'cite:empty',
  ],
  body: {
    type: String,
    required: true,
  },
  run(data: RoleData): (Cite | CiteGroup)[] {
    const content = data.body as string;
    const labels = content.split(/[,;]/).map((s) => s.trim());
    const kind: CiteKind =
      data.name.startsWith('cite:p') || data.name.includes('par') ? 'parenthetical' : 'narrative';
    const children = labels.map((l) => {
      const { label, identifier } = normalizeLabel(l) ?? {};
      const cite: Cite = {
        type: 'cite',
        kind,
        label: label ?? l,
        identifier,
      };
      if (data.name.startsWith('cite:year')) {
        cite.partial = 'year';
      }
      if (data.name.startsWith('cite:author') || data.name.startsWith('cite:cauthor')) {
        cite.partial = 'author';
      }
      return cite;
    });
    if (data.name === 'cite' && children.length === 1) {
      return children;
    }
    return [
      {
        type: 'citeGroup',
        kind,
        children,
      },
    ];
  },
};
