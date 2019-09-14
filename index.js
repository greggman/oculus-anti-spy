/*
Copyright 2018, Greggman.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.

    * Redistributions in binary form must reproduce the above
      copyright notice, this list of conditions and the following
      disclaimer in the documentation and/or other materials provided
      with the distribution.

    * Neither the name of Greggman. nor the names of their
      contributors may be used to endorse or promote products derived
      from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

'use strict';

const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const child_process = require('child_process');
const makeOptions = require('optionator');
const _ = require('lodash');
const readDirTree = require('./readdirtree.js');

const execFile = util.promisify(child_process.execFile);

const optionSpec = {
  options: [
    { option: 'help', alias: 'h', type: 'Boolean', description: 'displays help' },
    { option: 'mode', type: 'String',  required: true, description: 'save/restore/clean note: can not save if not clean', },
    { option: 'dir',  type: 'String', description: 'base folder to use', default: path.join(process.env.USERPROFILE)},
    { option: 'test', type: 'Boolean', description: 'just list actions, no effect' },
  ],
  helpStyle: {
    typeSeparator: '=',
    descriptionSeparator: ' : ',
    initialIndent: 4,
  },
  prepend: 'gen-font.js options',
};

const optionator = makeOptions(optionSpec);

let args;
try {
  args = optionator.parse(process.argv);
} catch (e) {
  console.error(e);
  printHelp();
}

function printHelp() {
  console.log(optionator.generateHelp());
  process.exit(1);  // eslint-disable-line
}

if (args.help) {
  printHelp();
}

const appdata = path.dirname(process.env.APPDATA);
if (path.basename(appdata) !== 'AppData') {
  console.error('appdata path does not end in "AppData":', appdata);
}

args.dir = path.join(args.dir, 'OculusBack');

const folders = [
  {
    orig: path.join(appdata, 'Local', 'Oculus'),
    back: path.join('AppData', 'Local', 'Oculus'),
  },
  {
    orig: path.join(appdata, 'LocalLow', 'Oculus'),
    back: path.join('AppData', 'LocalLow', 'Oculus'),
  },
  {
    orig: path.join(appdata, 'Roaming', 'Oculus'),
    back: path.join('AppData', 'Roaming', 'Oculus'),
  },
  {
    orig: path.join(appdata, 'Roaming', 'OculusClient'),
    back: path.join('AppData', 'Roaming', 'OculusClient'),
  },
  {
    orig: path.join(process.env.ProgramFiles, 'Oculus', 'CoreData', 'Manifests'),
    back: path.join('Program Files', 'Oculus', 'CoreData', 'Manifests'),
    filter: (orig, back) => orig.toLowerCase().endsWith('.json'),
  },
  {
    orig: path.join(process.env.ProgramFiles, 'Oculus', 'CoreData', '_global_data_store'),
    back: path.join('Program Files', 'Oculus', 'CoreData', '_global_data_store'),
    filter: (orig, back) => path.basename(orig).startsWith('data.sqlite'),
  },
  {
    orig: path.join(process.env.ProgramFiles, 'Oculus', 'CoreData', 'Software', 'StoreAssets'),
    back: path.join('Program Files', 'Oculus', 'CoreData', 'Software', 'StoreAssets'),
  },
];
const extraBackFolders = [args.dir, ..._.uniq(folders.map((folder) => {
  let {back} = folder;
  const extra = [];
  for(;;) {
    const dirname = path.dirname(back);
    if (dirname === back || dirname === '.') {
      break;
    }
    extra.push(path.join(args.dir, dirname));
    back = dirname;
  }
  return extra;
}).flat()).sort()].reverse();
folders.forEach((folder) => {
  folder.back = path.join(args.dir, folder.back);
});

async function save(options, folders) {
  if (fs.existsSync(options.dir)) {
    throw new Error(`can not save over existing save: ${options.dir}. Use --mode=clean`);
  }
  const mkdirSync = makeActionFunc(options.test, 'mkdir', fs.mkdirpSync.bind(fs));
  const copyFileSync = makeActionFunc(options.test, 'copy', fs.copyFileSync.bind(fs));

  mkdirSync(options.dir);

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

async function restore(options, folders) {
  if (!fs.existsSync(options.dir)) {
    throw new Error(`no save at: ${options.dir}.`);
  }

  const mkdirSync = makeActionFunc(options.test, 'mkdir', fs.mkdirpSync.bind(fs));
  const copyFileSync = makeActionFunc(options.test, 'copy', fs.copyFileSync.bind(fs));
  const rmdirSync = makeActionFunc(options.test, 'rmdir', fs.rmdirSync.bind(fs));
  const unlinkSync = makeActionFunc(options.test, 'delete', fs.unlinkSync.bind(fs));
  const removeSync = makeActionFunc(options.test, 'rm -rf', fs.removeSync.bind(fs));

  for (const folder of folders) {
    console.log('===[', folder.back, ']===');
    const {orig, back} = folder;
    const treeDiff = getTreeDiff(options, folder);
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
}

function safeStat(filename) {
  try {
    const stat = fs.statSync(filename);
    return stat;
  } catch (e) {
    return;
  }
}

async function clean(options, folders, extraFolders) {
  if (!fs.existsSync(options.dir)) {
    throw new Error(`no save at: ${options.dir}.`);
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

async function diff(options, folders) {
  if (!fs.existsSync(options.dir)) {
    throw new Error(`no save at: ${options.dir}.`);
  }
  for (const folder of folders) {
    const treeDiff = getTreeDiff(options, folder);
    const {origOnly, backOnly, notSame} = treeDiff;
    console.log('====', folder.orig, 'vs', folder.back, '====')
    console.log(origOnly.map(v => `  orig<: ${v}`).join('\n'));
    console.log(backOnly.map(v => `  back>: ${v}`).join('\n'));
    console.log(notSame.map(v =>  `  !=== : ${v}`).join('\n'));
  }
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

function getTreeDiff(options, folder) {
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

function noop() {
  return true;
}

const modes = {
  save,
  restore,
  clean,
  diff,
};

const fn = modes[args.mode];
if (!fn) {
  console.error(`unknown mode '${args.mode}'. Must be one of ${Object.keys(modes).join(', ')}`);
  process.exit(1);
}

fn(args, folders, extraBackFolders)
  .then(() => {
    console.log("==DONE==");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    // if (e.stack) {
    //   console.error(e.stack);
    // }
    process.exit(1);
  });


