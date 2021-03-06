'use strict';

const fs = require('fs');
const getProjectType = require('./get-project-type');
const getPackageVersion = require('./get-package-version');
const getVersions = require('./get-versions');
const getProjectVersion = require('./get-project-version');
const getTagVersion = require('./get-tag-version');
const getRemoteUrl = require('./get-remote-url');
const getCompareUrl = require('./get-compare-url');
const runCodemods = require('./run-codemods');
const mergePackageJson = require('merge-package.json');
const gitDiffApply = require('git-diff-apply');
const run = require('./run');
const utils = require('./utils');

module.exports = function emberCliUpdate(options) {
  let from = options.from;
  let to = options.to;
  let resolveConflicts = options.resolveConflicts;
  let _runCodemods = options.runCodemods;
  let reset = options.reset;
  let compareOnly = options.compareOnly;

  let projectType;

  try {
    projectType = getProjectType('.');
  } catch (err) {
    return Promise.reject(err);
  }

  let packageVersion;

  try {
    packageVersion = getPackageVersion('.', projectType);
  } catch (err) {
    return Promise.reject(err);
  }

  let versions = getVersions(projectType);

  let startVersion = from;
  if (!startVersion) {
    try {
      startVersion = getProjectVersion(packageVersion, versions, projectType);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  if (_runCodemods) {
    return runCodemods({
      projectType,
      startVersion
    });
  }

  let endVersion = getTagVersion(to, versions, projectType);

  let remoteUrl = getRemoteUrl(projectType);

  let startTag = `v${startVersion}`;
  let endTag = `v${endVersion}`;

  if (compareOnly) {
    return utils.opn(getCompareUrl({
      remoteUrl,
      startTag,
      endTag
    }));
  }

  let ignoredFiles;
  if (!reset) {
    ignoredFiles = ['package.json'];
  } else {
    ignoredFiles = [];
  }

  return gitDiffApply({
    remoteUrl,
    startTag,
    endTag,
    resolveConflicts,
    ignoredFiles,
    reset
  }).then(results => {
    if (reset) {
      return;
    }

    let myPackageJson = fs.readFileSync('package.json', 'utf8');
    let fromPackageJson = results.from['package.json'];
    let toPackageJson = results.to['package.json'];

    let newPackageJson = mergePackageJson(myPackageJson, fromPackageJson, toPackageJson);

    fs.writeFileSync('package.json', newPackageJson);

    run('git add package.json');
  });
};
