import fs from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import yaml from 'js-yaml';
import { writeFileToFolder } from 'myst-cli-utils';
import { fileError, fileWarn, RuleId } from 'myst-common';
import type { Config, ProjectConfig, SiteConfig, SiteProject } from 'myst-config';
import { getSiteTemplateOptions, validateProjectConfig, validateSiteConfig } from 'myst-config';
import type { ValidationOptions } from 'simple-validators';
import { incrementOptions, validateKeys, validateObject, validationError } from 'simple-validators';
import { VFile } from 'vfile';
import { prepareToWrite } from './frontmatter.js';
import { addWarningForFile, logMessagesFromVFile } from './index.js';
import type { ISession } from './session/types.js';
import { selectors } from './store/index.js';
import { config } from './store/reducers.js';

const VERSION = 1;

function emptyConfig(): Config {
  return {
    version: VERSION,
  };
}

export function defaultConfigFile(session: ISession, path: string) {
  return join(path, session.configFiles[0]);
}

export function configFromPath(session: ISession, path: string) {
  const configs = session.configFiles
    .map((file) => {
      return join(path, file);
    })
    .filter((file) => {
      return fs.existsSync(file);
    });
  if (configs.length > 1) throw Error(`Multiple config files in ${path}`);
  if (configs.length === 0) return undefined;
  return configs[0];
}

export function readConfig(session: ISession, vfile: VFile) {
  const file = vfile.path;
  if (!fs.existsSync(file)) throw Error(`Cannot find config file: ${file}`);
  const opts: ValidationOptions = {
    file,
    property: 'config',
    messages: {},
    errorLogFn: (message: string) => {
      fileError(vfile, message, { ruleId: RuleId.validConfigStructure });
    },
    warningLogFn: (message: string) => {
      fileWarn(vfile, message, { ruleId: RuleId.validConfigStructure });
    },
  };
  const conf = validateObject(yaml.load(fs.readFileSync(file, 'utf-8')), opts);
  if (conf) {
    const filteredConf = validateKeys(
      conf,
      { required: ['version'], optional: ['site', 'project'] },
      opts,
    );
    if (filteredConf && filteredConf.version !== VERSION) {
      validationError(
        `"${filteredConf.version}" does not match ${VERSION}`,
        incrementOptions('version', opts),
      );
    }
  }
  logMessagesFromVFile(session, vfile);
  if (!conf || opts.messages.errors) {
    throw Error(`Please address invalid config file ${file}`);
  }
  // Keep original config object with extra keys, etc.
  if (conf.site?.frontmatter) {
    fileWarn(
      vfile,
      `Frontmatter fields should be defined directly on site, not nested under "${file}#site.frontmatter"`,
      { ruleId: RuleId.configHasNoDeprecatedFields },
    );
    const { frontmatter, ...rest } = conf.site;
    conf.site = { ...frontmatter, ...rest };
  }
  if (conf.project?.frontmatter) {
    fileWarn(
      vfile,
      `Frontmatter fields should be defined directly on project, not nested under "${file}#project.frontmatter"`,
      { ruleId: RuleId.configHasNoDeprecatedFields },
    );
    const { frontmatter, ...rest } = conf.project;
    conf.project = { ...frontmatter, ...rest };
  }
  if (conf.site?.logoText) {
    fileWarn(vfile, `logoText is deprecated, please use logo_text in "${file}#site"`, {
      ruleId: RuleId.configHasNoDeprecatedFields,
    });
    const { logoText, ...rest } = conf.site;
    conf.site = { logo_text: logoText, ...rest };
  }
  logMessagesFromVFile(session, vfile);
  return conf;
}

function resolveToAbsolute(session: ISession, basePath: string, relativePath: string) {
  let message: string;
  try {
    const absPath = resolve(join(basePath, relativePath));
    if (fs.existsSync(absPath)) {
      return absPath;
    }
    message = `Does not exist as local path: ${absPath}`;
  } catch {
    message = `Unable to resolve as local path: ${relativePath}`;
  }
  session.log.debug(message);
  return relativePath;
}

function resolveToRelative(session: ISession, basePath: string, absPath: string) {
  let message: string;
  try {
    if (fs.existsSync(absPath)) {
      // If it is the same path, use a '.'
      return relative(basePath, absPath) || '.';
    }
    message = `Does not exist as local path: ${absPath}`;
  } catch {
    message = `Unable to resolve as relative path: ${absPath}`;
  }
  session.log.debug(message);
  return absPath;
}

function resolveSiteConfigPaths(
  session: ISession,
  path: string,
  siteConfig: SiteConfig,
  resolutionFn: (session: ISession, basePath: string, path: string) => string,
) {
  const resolvedFields: SiteConfig = {};
  if (siteConfig.projects) {
    resolvedFields.projects = siteConfig.projects.map((proj) => {
      if (proj.path) {
        return { ...proj, path: resolutionFn(session, path, proj.path) };
      }
      return proj;
    });
  }
  if (siteConfig.favicon) {
    resolvedFields.favicon = resolutionFn(session, path, siteConfig.favicon);
  }
  return { ...siteConfig, ...resolvedFields };
}

function resolveProjectConfigPaths(
  session: ISession,
  path: string,
  projectConfig: ProjectConfig,
  resolutionFn: (session: ISession, basePath: string, path: string) => string,
) {
  const resolvedFields: ProjectConfig = {};
  if (projectConfig.bibliography) {
    resolvedFields.bibliography = projectConfig.bibliography.map((file) => {
      return resolutionFn(session, path, file);
    });
  }
  if (projectConfig.index) {
    resolvedFields.index = resolutionFn(session, path, projectConfig.index);
  }
  if (projectConfig.exclude) {
    resolvedFields.exclude = projectConfig.exclude.map((file) => {
      return resolutionFn(session, path, file);
    });
  }
  if (projectConfig.plugins) {
    resolvedFields.plugins = projectConfig.plugins.map((file) => {
      const resolved = resolutionFn(session, path, file);
      if (fs.existsSync(resolved)) return resolved;
      return file;
    });
  }
  return { ...projectConfig, ...resolvedFields };
}

function validateSiteConfigAndSave(
  session: ISession,
  path: string,
  vfile: VFile,
  rawSiteConfig: Record<string, any>,
) {
  let siteConfig = validateSiteConfig(rawSiteConfig, {
    file: vfile.path,
    property: 'site',
    messages: {},
    errorLogFn: (message: string) => {
      fileError(vfile, message, { ruleId: RuleId.validSiteConfig });
    },
    warningLogFn: (message: string) => {
      fileWarn(vfile, message, { ruleId: RuleId.validSiteConfig });
    },
  });
  logMessagesFromVFile(session, vfile);
  if (!siteConfig) {
    const errorSuffix = vfile.path ? ` in ${vfile.path}` : '';
    throw Error(`Please address invalid site config${errorSuffix}`);
  }
  siteConfig = resolveSiteConfigPaths(session, path, siteConfig, resolveToAbsolute);
  session.store.dispatch(config.actions.receiveSiteConfig({ path, ...siteConfig }));

  let siteTemplateOptions = getSiteTemplateOptions(rawSiteConfig);
  if (siteTemplateOptions.logo) {
    siteTemplateOptions = {
      ...siteTemplateOptions,
      logo: resolveToAbsolute(session, path, siteTemplateOptions.logo),
    };
  }
  session.store.dispatch(
    config.actions.receiveSiteTemplateOptions({ path, ...siteTemplateOptions }),
  );
}

function validateProjectConfigAndSave(
  session: ISession,
  path: string,
  vfile: VFile,
  rawProjectConfig: Record<string, any>,
) {
  let projectConfig = validateProjectConfig(rawProjectConfig, {
    file: vfile.path,
    property: 'project',
    messages: {},
    errorLogFn: (message: string) => {
      fileError(vfile, message, { ruleId: RuleId.validProjectConfig });
    },
    warningLogFn: (message: string) => {
      fileWarn(vfile, message, { ruleId: RuleId.validProjectConfig });
    },
  });
  logMessagesFromVFile(session, vfile);
  if (!projectConfig) {
    const errorSuffix = vfile.path ? ` in ${vfile.path}` : '';
    throw Error(`Please address invalid project config${errorSuffix}`);
  }
  projectConfig = resolveProjectConfigPaths(session, path, projectConfig, resolveToAbsolute);
  session.store.dispatch(config.actions.receiveProjectConfig({ path, ...projectConfig }));
}

/**
 * Load site/project config from local path to redux store
 *
 * Errors if config file does not exist or if config file exists but is invalid.
 */
export function loadConfigAndValidateOrThrow(session: ISession, path: string) {
  const file = configFromPath(session, path);
  if (!file) {
    session.log.debug(`No config loaded from path: ${path}`);
    return;
  }
  const vfile = new VFile();
  vfile.path = file;
  const conf = readConfig(session, vfile);
  const existingConf = selectors.selectLocalRawConfig(session.store.getState(), path);
  if (existingConf && JSON.stringify(conf) === JSON.stringify(existingConf)) {
    return;
  }
  session.store.dispatch(config.actions.receiveRawConfig({ path, file, ...conf }));
  const { site, project } = conf;
  if (site) {
    validateSiteConfigAndSave(session, path, vfile, site);
    session.log.debug(`Loaded site config from ${file}`);
  } else {
    session.log.debug(`No site config in ${file}`);
  }
  if (project) {
    validateProjectConfigAndSave(session, path, vfile, project);
    session.log.debug(`Loaded project config from ${file}`);
  } else {
    session.log.debug(`No project config defined in ${file}`);
  }
}

/**
 * Write site config and config to path, if available
 *
 * If newConfigs are provided, the redux store will be updated with these
 * configs before writing.
 *
 * If a config file exists on the path, this will override the
 * site portion of the config and leave the rest.
 */
export function writeConfigs(
  session: ISession,
  path: string,
  newConfigs?: {
    siteConfig?: Record<string, any>;
    projectConfig?: Record<string, any>;
  },
) {
  // TODO: siteConfig -> rawSiteConfig before writing, don't lose extra keys in raw.
  //       also shouldn't need to re-readConfig...
  let { siteConfig, projectConfig } = newConfigs || {};
  const file = configFromPath(session, path) || defaultConfigFile(session, path);
  // Get site config to save
  const vfile = new VFile();
  vfile.path = file;
  if (siteConfig) validateSiteConfigAndSave(session, path, vfile, siteConfig);
  siteConfig = selectors.selectLocalSiteConfig(session.store.getState(), path);
  if (siteConfig) {
    siteConfig = resolveSiteConfigPaths(session, path, siteConfig, resolveToRelative);
  }
  // Get project config to save
  if (projectConfig) validateProjectConfigAndSave(session, path, vfile, projectConfig);
  projectConfig = selectors.selectLocalProjectConfig(session.store.getState(), path);
  if (projectConfig) {
    projectConfig = prepareToWrite(projectConfig);
    projectConfig = resolveProjectConfigPaths(session, path, projectConfig, resolveToRelative);
  }
  // Return early if nothing new to save
  if (!siteConfig && !projectConfig) {
    session.log.debug(`No new config to write to ${file}`);
    return;
  }
  // Get raw config to override
  let rawConfig = selectors.selectLocalRawConfig(session.store.getState(), path);
  if (!rawConfig && configFromPath(session, path)) {
    rawConfig = readConfig(session, vfile);
  } else if (!rawConfig) {
    rawConfig = emptyConfig();
  }
  let logContent: string;
  if (siteConfig && projectConfig) {
    logContent = 'site and project configs';
  } else if (siteConfig) {
    logContent = 'site config';
  } else {
    logContent = 'project config';
  }
  session.log.debug(`Writing ${logContent} to ${file}`);
  // Combine site/project configs with
  const newConfig = { ...rawConfig };
  if (siteConfig) newConfig.site = { ...rawConfig.site, ...siteConfig };
  if (projectConfig) newConfig.project = { ...rawConfig.project, ...projectConfig };
  writeFileToFolder(file, yaml.dump(newConfig), 'utf-8');
}

export async function findCurrentProjectAndLoad(
  session: ISession,
  path: string,
): Promise<string | undefined> {
  path = resolve(path);
  if (configFromPath(session, path)) {
    loadConfigAndValidateOrThrow(session, path);
    const project = selectors.selectLocalProjectConfig(session.store.getState(), path);
    if (project) {
      session.store.dispatch(config.actions.receiveCurrentProjectPath({ path: path }));
      return path;
    }
  }
  if (dirname(path) === path) {
    return undefined;
  }
  return findCurrentProjectAndLoad(session, dirname(path));
}

export async function findCurrentSiteAndLoad(
  session: ISession,
  path: string,
): Promise<string | undefined> {
  path = resolve(path);
  if (configFromPath(session, path)) {
    loadConfigAndValidateOrThrow(session, path);
    const site = selectors.selectLocalSiteConfig(session.store.getState(), path);
    if (site) {
      session.store.dispatch(config.actions.receiveCurrentSitePath({ path: path }));
      return path;
    }
  }
  if (dirname(path) === path) {
    return undefined;
  }
  return findCurrentSiteAndLoad(session, dirname(path));
}

export function reloadAllConfigsForCurrentSite(session: ISession) {
  const state = session.store.getState();
  const sitePath = selectors.selectCurrentSitePath(state);
  const file =
    selectors.selectCurrentProjectFile(state) ?? defaultConfigFile(session, resolve('.'));
  if (!sitePath) {
    const message =
      'Cannot (re)load site config. No configuration file found with "site" property.';
    addWarningForFile(session, file, message, 'error', { ruleId: RuleId.siteConfigExists });
    throw Error(message);
  }
  loadConfigAndValidateOrThrow(session, sitePath);
  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  if (!siteConfig?.projects) return;
  siteConfig.projects
    .filter((project): project is SiteProject & { path: string } => {
      return Boolean(project.path);
    })
    .forEach((project) => {
      try {
        loadConfigAndValidateOrThrow(session, project.path);
      } catch (error) {
        // TODO: what error?
        session.log.debug(`Failed to find or load project config from "${project.path}"`);
      }
    });
}
