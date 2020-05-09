const fs = require('fs-extra');
const path = require('path');
const {
  makeActionFunc,
  getTreeDiff,
} = require('./utils');

async function restore(backupDir, folders, options) {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`no save at: ${backupDir}.`);
  }

  const mkdirSync = makeActionFunc(options.test, 'mkdir', fs.mkdirpSync.bind(fs));
  const copyFileSync = makeActionFunc(options.test, 'copy', fs.copyFileSync.bind(fs));
  const rmdirSync = makeActionFunc(options.test, 'rmdir', fs.rmdirSync.bind(fs));
  const unlinkSync = makeActionFunc(options.test, 'delete', fs.unlinkSync.bind(fs));
  const removeSync = makeActionFunc(options.test, 'rm -rf', fs.removeSync.bind(fs));

  for (const folder of folders) {
    console.log('===[', folder.back, ']===');
    const {orig, back} = folder;
    const treeDiff = getTreeDiff(folder, options);
    const {origOnly, backOnly, notSame, inBoth} = treeDiff;

    const origOnlyDirs = [];
    origOnly.forEach((filename) => {
      const origFilename = path.join(orig, filename);
      const stat = fs.statSync(origFilename);
      if (stat.isDirectory()) {
        origOnlyDirs.push(origFilename);
      } else {
        unlinkSync(origFilename);
      }
    });

    origOnlyDirs.forEach(v => removeSync(v));

    [...backOnly, ...notSame].forEach((filename) => {
      const origFilename = path.join(orig, filename);
      const backFilename = path.join(back, filename);
      const stat = fs.statSync(backFilename);
      if (!stat.isDirectory()) {
        const origDirname = path.dirname(origFilename);
        if (!fs.existsSync(origDirname)) {
          mkdirSync(origDirname);
        }
        copyFileSync(backFilename, origFilename);
      }
    });
  }

  {
    const restored = path.join(backupDir, 'restored.txt');
    fs.writeFileSync(restored, 'restored');
  }
}

module.exports = restore;
