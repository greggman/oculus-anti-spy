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

const path = require('path');
const makeOptions = require('optionator');
const _ = require('lodash');
const save = require('./src/save.js');
const restore = require('./src/restore.js');
const clean = require('./src/clean.js');
const diff = require('./src/diff.js');

const optionSpec = {
  options: [
    { option: 'help', alias: 'h', type: 'Boolean', description: 'displays help' },
    { option: 'service', alias: 's', type: 'String', description: 'which service to backup/restore', enum: ['oculus', 'steam', 'test'], default: 'oculus'},
    { option: 'mode', type: 'String',  required: true, description: 'save/restore/clean note: can not save if not clean', },
    { option: 'dir',  type: 'String', description: 'base folder to use', default: path.join(process.env.USERPROFILE)},
    { option: 'force', type: 'Boolean', description: 'force copies. By default only files with different dates/sizes are copied', default: 'false'},
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

function origBack(origBase, backBase, ...dirs) {
  return {
    orig: path.join(origBase, ...dirs),
    back: path.join(backBase, ...dirs),
  };
}

function oculus() {
  const backupDir = args.dir = path.join(args.dir, 'OculusBack');

  const folders = [
    {
      ...origBack(appdata, 'AppData', 'Local', 'Oculus'),
    },
    {
      ...origBack(appdata, 'AppData', 'LocalLow', 'Oculus'),
    },
    {
      ...origBack(appdata, 'AppData', 'Roaming', 'Oculus'),
    },
    {
      ...origBack(appdata, 'AppData', 'Roaming', 'OculusClient'),
    },
    {
      ...origBack(process.env.ProgramFiles, 'Program Files', 'Oculus', 'CoreData', 'Manifests'),
      filter: (orig, back) => orig.toLowerCase().endsWith('.json'),
    },
    {
      ...origBack(process.env.ProgramFiles, 'Program Files', 'Oculus', 'CoreData', '_global_data_store'),
      filter: (orig, back) => path.basename(orig).startsWith('data.sqlite'),
    },
    {
      ...origBack(process.env.ProgramFiles, 'Program Files', 'Oculus', 'CoreData', 'Software', 'StoreAssets'),
    },
  ];
  return {backupDir, folders};
}

function steam() {
  const backupDir = args.dir = path.join(args.dir, 'SteamBack');

  const folders = [
    {
      ...origBack(appdata, 'AppData', 'Local', 'Steam'),
    },
    {
      ...origBack(appdata, 'AppData', 'Local', 'SteamVR'),
    },
    {
      ...origBack(process.env['ProgramFiles(x86)'], 'Program Files  (x86)', 'Steam', 'Logs'),
    },
  ];
  return {backupDir, folders};
}

function test() {
  const backupDir = args.dir = path.join(args.dir, 'TestBack');

  const folders = [
    {
      ...origBack(__dirname, 'test', 'test', 'srcData'),
    },
  ];
  return {backupDir, folders};
}

const services = {
  oculus,
  steam,
  test,
};

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

const {backupDir, folders} = services[args.service]();
// the children of the root folders of the back up and the root itself
const extraBackFolders = [backupDir, ..._.uniq(folders.map((folder) => {
  let {back} = folder;
  const extra = [];
  for(;;) {
    const dirname = path.dirname(back);
    if (dirname === back || dirname === '.') {
      break;
    }
    extra.push(path.join(backupDir, dirname));
    back = dirname;
  }
  return extra;
}).flat()).sort()].reverse();
// tack on the the backup dir to all backups
folders.forEach((folder) => {
  folder.back = path.join(backupDir, folder.back);
});

async function main() {
  try {
    await fn(backupDir, folders, args, extraBackFolders);
    console.log(`== Finished ${args.mode} ==`);
    process.exit(0);
  } catch(e) {
    console.error(e);
    // if (e.stack) {
    //   console.error(e.stack);
    // }
    process.exit(1);
  }
}

main();
