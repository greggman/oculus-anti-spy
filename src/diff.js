
const fs = require('fs-extra');
const {
  getTreeDiff,
} = require('./utils.js');

async function diff(backupDir, folders, options) {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`no save at: ${backupDir}.`);
  }
  for (const folder of folders) {
    const treeDiff = getTreeDiff(folder, options);
    const {origOnly, backOnly, notSame} = treeDiff;
    console.log('====', folder.orig, 'vs', folder.back, '====')
    console.log(origOnly.map(v => `  orig<: ${v}`).join('\n'));
    console.log(backOnly.map(v => `  back>: ${v}`).join('\n'));
    console.log(notSame.map(v =>  `  !=== : ${v}`).join('\n'));
  }
}