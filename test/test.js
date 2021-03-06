const path = require('path');
const fs = require('fs-extra');
const tmp = require('tmp');
const assert = require('chai').assert;

const save = require('../src/save');
const restore = require('../src/restore');
const clean = require('../src/clean');
const diff = require('../src/diff');

const readDirTree = require('../src/readdirtree');
const {safeStat} = require('../src/utils');

const testSrcDir = tmp.dirSync().name;
const testDstDir = tmp.dirSync().name;

const origFiles = [
  { name: 'foo.txt', content: '1234567', },
  { name: 'bar.txt', content: 'abcedf', },
  { 
    name: 'subDir',
    children: [
      { name: 'abc.json', content: '{"abc":"def"}'},
      { name: 'def.xml', content: '<"abc">def</abc>'},
      {
        name: 'subSubDir',
        children: [
          { name: 'abc.json', content: '{"abc":"def"}'},
          { name: 'def.xml', content: '<"abc">def</abc>'},
        ],
      },
    ],
  },
];

const backupFiles =  [
  {
    name: 'back',
    children: origFiles,
  }
];

const modifiedFiles = [
  { name: 'foo.txt', content: '12345678', },
  { name: 'bar.txt', content: 'abcedf', },
  { 
    name: 'subDir',
    children: [
      { name: 'def.xml', content: '<"abc">def</abc>'},
      {
        name: 'subSubDir',
        children: [
          { name: 'abc.json', content: '{"abc":"def"}'},
          { name: 'def.xml', content: '<"abc">def</abc>'},
          { name: 'extra.txt', content: 'extra'},
        ],
      },
      {
        name: 'extraSubDir',
        children: [
          { name: 'moreExtra.txt', content: 'moreExtra'},
        ],
      },
    ],
  },
];

function makeTree(dir, newChildren) {
  fs.mkdirSync(dir);
  for (const {name, children, content} of newChildren) {
    const filename = path.join(dir, name);
    if (children) {
      makeTree(filename, children);
    } else {
      fs.writeFileSync(filename, content, {encoding: 'utf8'});
    }
  }
}

function recursiveListing(root) {
  const filenames = readDirTree.sync(root);
  const listing = filenames.map(filename => {
    const stat = fs.statSync(path.join(root, filename));
    return {
      filename,
      size: stat.size,
      mtime: stat.isDirectory() ? 0 : stat.mtimeMs,
    };
  });
  return listing;
}

function compareListings(aPath, bPath) {
  const aListing = recursiveListing(aPath);
  const bListing = recursiveListing(bPath);
  assert.deepEqual(aListing, bListing);
}

describe('force', () => {
  const options = {force: true};

  beforeEach(async () => {
    fs.removeSync(testSrcDir);
    fs.removeSync(testDstDir);
  });

  afterEach(async () => {
    fs.removeSync(testSrcDir);
  });

  it('saves', async () => {
    makeTree(testSrcDir, origFiles);
    const orig = testSrcDir;
    const back = path.join(testDstDir, 'back');
    await save(testDstDir, [{orig, back}], options);
    const actual = recursiveListing(back);
    const expected = recursiveListing(testSrcDir);
    assert.deepEqual(actual, expected);
  });

  it('restores', async() => {
    makeTree(testSrcDir, modifiedFiles);
    makeTree(testDstDir, backupFiles);
    const orig = testSrcDir;
    const back = path.join(testDstDir, 'back');
    await restore(testDstDir, [{orig, back}], options);
    const actual = recursiveListing(testSrcDir);
    const expected = recursiveListing(back);
    assert.deepEqual(actual, expected);
  });

  it('cleans',  async() => {
    makeTree(testDstDir, backupFiles);
    const orig = testSrcDir;
    const back = path.join(testDstDir, 'back');
    await clean(testDstDir, [{orig, back}], options, []);
    const stat = safeStat(testSrcDir);
    assert.strictEqual(stat, undefined);
  });
});

/*
describe('incremental', () => {
  const options = {force: false};

  beforeEach(async () => {
    fs.removeSync(testSrcDir);
    fs.removeSync(testDstDir);
  });

  afterEach(async () => {
    fs.removeSync(testSrcDir);
  });

  it('saves', async() => {
    makeTree(testSrcDir, origFiles);
    const orig = testSrcDir;
    const back = path.join(testDstDir, 'back');
    await save(testDstDir, [{orig, back}], options);

    // check if we add modify a file it gets copied
    makeTree(testSrcDir, [
      { name: 'foo.txt', content: '1234568', },
      { 
        name: 'subDir',
        children: [
          { name: 'abc.json', content: '{"abc":"defs"}'},
          {
            name: 'subSubDir',
            children: [
              { name: 'def.xml', content: '<"abc">xyz</abc>'},
            ],
          },
        ],
      },
    ]);
    await save(testDstDir, [{orig, back}], options);
    compareListings(testSrcDir, back);

    // check if we add a file it gets copied
    makeTree(testSrcDir, [
      { name: 'foo2.txt', content: '1234568a', },
      { 
        name: 'subDir',
        children: [
          {
            name: 'subSubDir',
            children: [
              { name: 'ghi.xml', content: '<"str">---</str>'},
            ],
          },
        ],
      },
    ]);
    await save(testDstDir, [{orig, back}], options);
    compareListings(testSrcDir, back);

    // check if we add a folder it gets copied
    makeTree(testSrcDir, [
      { 
        name: 'subDir',
        children: [
          {
            name: 'newSubDir',
            children: [
              { name: 'stuff.xml', content: '<"str">foo</str>'},
            ],
          },
        ],
      },
    ]);
    await save(testDstDir, [{orig, back}], options);
    compareListings(testSrcDir, back);

    // check if we remove a file it gets removed
    fs.unlinkSync(path.join(testSrcDir, 'subDir', 'newSubDir'));
    await save(testDstDir, [{orig, back}], options);
    compareListings(testSrcDir, back); 

    // check if we remove folder it gets removed
    fs.removeSync(path.join(testSrcDir, 'subDir', 'abc.json'));
    await save(testDstDir, [{orig, back}], options);
    compareListings(testSrcDir, back); 
  });
});
*/

/*
describe('runs from command-line', () => {

  const script = path.join(__dirname, '..', 'index.js');
  const srcPath = path.join(__dirname, 'srcData');
  const dstPath = testDstDir;

  before(async() => {
    fs.removeSync(dstPath);
  });

  after(async() => {
    fs.removeSync(dstPath);
  });

  it('save/restore/clean', async() => {
    await exec('node.exe', [
      script,
      '--mode=save',
      '--service=test',
      `--dir=${dstPath}`,
    ]);
    const backPath = path.join(dstPath, 'TestBack');
    const dstDataPath = path.join(backPath, 'test', 'test', 'srcData');
    compareListings(srcPath, dstDataPath); 

    await exec('node.exe', [
      script,
      '--mode=restore',
      '--service=test',
      `--dir=${dstPath}`,
    ]);

    await exec('node.exe', [
      script,
      '--mode=clean',
      '--service=test',
      `--dir=${dstPath}`,
    ]);

    const stat = safeStat(backPath);
    assert.strictEqual(stat, undefined);
  });
});
*/
