const fs = require('fs-extra');
const path = require('path');
const readDirTree = require('./readdirtree');
const {
  makeActionFunc,
} = require('./utils');

function noop() {
  return true;
}

async function save(backupDir, folders, options) {
  if (fs.existsSync(backupDir)) {
    throw new Error(`can not save over existing save: ${backupDir}. Use --mode=clean`);
  }
  const mkdirSync = makeActionFunc(options.test, 'mkdir', fs.mkdirpSync.bind(fs));
  const copyFileSync = makeActionFunc(options.test, 'copy', fs.copyFileSync.bind(fs));

  mkdirSync(backupDir);

  for (const folder of folders) {
    console.log('===[', folder.orig, ']===');
    const {orig, back, filter} = folder;
    const origFiles = readDirTree.sync(orig).filter(filter || noop);
    for (const filename of origFiles) {
      const origFilename = path.join(orig, filename);
      const backFilename = path.join(back, filename);
      const stat = fs.statSync(origFilename);
      if (!stat.isDirectory()) {
        const backDirname = path.dirname(backFilename);
        if (!fs.existsSync(backDirname)) {
          mkdirSync(backDirname);
        }
        copyFileSync(origFilename, backFilename);
      }
    }
  }
}

module.exports = save;