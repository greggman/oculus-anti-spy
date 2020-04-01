const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const readDirTree = require('./readdirtree');
const child_process = require('child_process');

function exec(file, args) {
  return new Promise((resolve, reject) => {
    child_process.execFile(file, args, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve({stdout, stderr});
      }
    });
  });
}

function noop() {
  return true;
}

function makeActionFunc(test, desc, fn) {
  if (test) {
    return function(...args) {
      console.log('would', desc, ...args);
    };
  }

  return function(...args) {
    console.log(desc, ...args);
    fn(...args);
  }
}

function getTreeDiff(folder, options) {
  const {orig, back, filter} = folder;
  const origFiles = readDirTree.sync(orig).filter(filter || noop);
  const backFiles = readDirTree.sync(back).filter(filter || noop);
  const origOnly = _.difference(origFiles, backFiles);
  const backOnly = _.difference(backFiles, origFiles);
  const inBoth = _.intersection(origFiles, backFiles);
  const notSame = inBoth.filter((filename) => {
    const origStat = fs.statSync(path.join(orig, filename));
    const backStat = fs.statSync(path.join(back, filename));
    return origStat.mtime !== backStat.mtime || origStat.size !== backStat.size;
  });
  return {
    origOnly,
    backOnly,
    inBoth,
    notSame,
  };
}

function safeStat(filename) {
  try {
    const stat = fs.statSync(filename);
    return stat;
  } catch (e) {
    return;
  }
}

function makeWritable(filename) {
  const stat = fs.statSync(filename);
  const newMode = stat.mode | 0o222;
  fs.chmodSync(filename, newMode);
}

module.exports = {
  exec,
  makeActionFunc,
  makeWritable,
  getTreeDiff,
  safeStat,
};