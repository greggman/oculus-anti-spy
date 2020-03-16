const fs = require('fs-extra');
const path = require('path');
const readDirTree = require('./readdirtree');
const {
  makeActionFunc,
  safeStat,
} = require('./utils');

async function clean(backupDir, folders, options, extraFolders) {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`no save at: ${backupDir}.`);
  }
  const rmdirSync = makeActionFunc(options.test, 'rmdir', fs.rmdirSync.bind(fs));
  const unlinkSync = makeActionFunc(options.test, 'delete', fs.unlinkSync.bind(fs));
  const removeSync = makeActionFunc(options.test, 'rm -rf', fs.removeSync.bind(fs));

  for (const folder of folders) {
    const {orig, back} = folder;
    const stat = safeStat(back);
    if (!stat) {
      continue;
    }
    const backFiles = readDirTree.sync(back).sort().reverse();
    for (const filename of backFiles) {
      const backFilename = path.join(back, filename);
      const stat = fs.statSync(backFilename);
      if (stat.isDirectory()) {
        rmdirSync(backFilename);
      } else {
        unlinkSync(backFilename);
      }
    }
  }

  for (const folder of extraFolders) {
    const stat = safeStat(folder);
    if (stat) {
      removeSync(folder);
    }
  }
}

module.exports = clean;