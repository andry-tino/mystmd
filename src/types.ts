import { Author, ExportableFormatTypes } from '@curvenote/blocks';

// Frontmatter and Site/Project Configs
//
// loaded directly from curvenote.yml

type License = {
  title: string;
  url: string;
  id: string;
  free?: boolean;
  CC?: boolean;
  osi?: boolean;
};

export type Frontmatter = {
  title?: string;
  description?: string | null;
  authors?: Author[];
  subject?: string;
  open_access?: boolean;
  license?: string | License | { code?: License; content?: License };
  oxa?: string;
  doi?: string;
  github?: string;
  venue?:
    | string
    | {
        title?: string;
        url?: string;
      };
  // https://docs.openalex.org/about-the-data/work#biblio
  biblio?: {
    volume?: string | number; // sometimes you'll get fun values like "Spring" and "Inside cover."
    issue?: string | number;
    first_page?: string | number;
    last_page?: string | number;
  };
  numbering?:
    | boolean
    | {
        enumerator?: string;
        figure?: boolean;
        equation?: boolean;
        table?: boolean;
        code?: boolean;
        heading_1?: boolean;
        heading_2?: boolean;
        heading_3?: boolean;
        heading_4?: boolean;
        heading_5?: boolean;
        heading_6?: boolean;
      };
  /** Math macros to be passed to KaTeX or LaTeX */
  math?: Record<string, string>;
} & Record<string, any>;

export type ProjectConfig = {
  title: string;
  description?: string | null;
  frontmatter?: Omit<Frontmatter, 'title' | 'description'>;
  remote?: string;
  index?: string;
  exclude?: string[];
};

export type SiteProject = {
  path: string;
  slug: string;
};

export type SiteNavPage = {
  title: string;
  url: string;
};

export type SiteNavFolder = {
  title: string;
  children: SiteNavItem[];
};

export type SiteNavItem = SiteNavPage | SiteNavFolder;

export type SiteAction = SiteNavPage & {
  static?: boolean;
};

export type SiteConfig = {
  title: string;
  frontmatter?: Omit<Frontmatter, 'title' | 'description'>;
  twitter?: string;
  domains: string[];
  logo?: string | null;
  logoText?: string;
  favicon?: string;
  buildPath?: string;
  design?: {
    hide_authors?: boolean;
  };
  projects: SiteProject[];
  nav: SiteNavItem[];
  actions: SiteAction[];
};

export type Config = {
  version: 1;
  project?: ProjectConfig;
  site?: SiteConfig;
};

// Types for local Project
//
// Files are local paths relative to the current directory.
// These are autogenerated based on curvenote.yml

export type pageLevels = 1 | 2 | 3 | 4 | 5 | 6;

export type LocalProjectFolder = {
  title: string;
  level: pageLevels;
};

export type LocalProjectPage = {
  file: string;
  slug: string;
} & LocalProjectFolder;

export type LocalProject = {
  path: string;
  /** The local path to the local index file. */
  file: string;
  /** The slug that the index get's renamed to for the JSON */
  index: string;
  title: string;
  citations: string[];
  pages: (LocalProjectPage | LocalProjectFolder)[];
};

// Manifest shipped with site content
//
// Combines info from config, local project.
// Removes local path info

export type ManifestProjectFolder = {
  title: string;
  level: pageLevels;
};

export type ManifestProjectPage = {
  slug: string;
} & ManifestProjectFolder;

export type ManifestProject = {
  slug: string;
  index: string;
  title: string;
  pages: (ManifestProjectPage | ManifestProjectFolder)[];
  frontmatter?: Frontmatter;
};

export type SiteManifest = {
  title: string;
  twitter?: string;
  logo?: string;
  logoText?: string;
  nav: SiteNavItem[];
  actions: SiteAction[];
  projects: ManifestProject[];
};

export type NavItem = {
  title: string;
  url: string;
  children?: Omit<NavItem, 'children'>[]; // Only one deep
};

export interface WebConfig {
  name: string;
  nav: NavItem[];
  sections: { title: string; folder: string; path: string }[];
  actions: { title: string; url: string; static?: boolean }[];
  favicon?: string | null;
  logo?: string | null;
  logoText?: string | null;
  design?: {
    hide_authors?: boolean;
  };
  /** Domain hostname, for example, docs.curve.space or docs.curvenote.com */
  domains?: string[];
  /** Twitter handle for the site (not the article) */
  twitter?: string | null;
}

export interface ExportConfig {
  name: string;
  kind: ExportableFormatTypes;
  project: string;
  folder: string;
  filename?: string;
  template?: string;
  templatePath?: string;
  contents: { name?: string; link?: string; version?: number }[];
  data: {
    title?: string;
    short_title?: string;
    description?: string;
    date?: string;
    authors?: {
      name?: string;
      id?: string;
      corresponding?: boolean;
      email?: string;
    }[];
  } & Record<string, any>;
}
