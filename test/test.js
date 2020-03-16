const path = require('path');
const fs = require('fs-extra');

const {describe, it, run, before, after, beforeEach, afterEach} = require('./runner.js');

const save = require('../src/save');
const restore = require('../src/restore');
const clean = require('../src/clean');
const diff = require('../src/diff');

const readDirTree = require('../src/readdirtree');
const {safeStat} = require('../src/utils');

const testSrcDir = path.join(__dirname, 'src');
const testDstDir = path.join(__dirname, 'dst');

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

const expectedSave = [
  "back",
  "back\\bar.txt",
  "back\\foo.txt",
  "back\\subDir",
  "back\\subDir\\abc.json",
  "back\\subDir\\def.xml",
  "back\\subDir\\subSubDir",
  "back\\subDir\\subSubDir\\abc.json",
  "back\\subDir\\subSubDir\\def.xml"
];

const expectedRestore = [
  "bar.txt",
  "foo.txt",
  "subDir",
  "subDir\\abc.json",
  "subDir\\def.xml",
  "subDir\\subSubDir",
  "subDir\\subSubDir\\abc.json",
  "subDir\\subSubDir\\def.xml"
];

const assert = {
  deepEqual(actual, expected) {
    if (actual === expected) {
      return;
    }
    if (Array.isArray(actual)) {
      if (!Array.isArray(expected)) {
        throw new Error('b is not array');
      }
      if (actual.length !== expected.length) {
        throw new Error('arrays not same length');
      }
      for (let i = 0; i < actual.length; ++i) {
        try {
          assert.deepEqual(actual[i], expected[i]);
        } catch(e) {
          throw new Error(`arrays do not match at element ${i}`);
        }
      }
    } else {
      throw new Error('unhandled');
    }
  },
  strictEqual(actual, expected) {
    if (actual !== expected) {
      throw new Error(`expected ${expected}, was ${actual}`);
    }
  }
}

describe('full', () => {

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
    await save(testDstDir, [{orig, back}], {});
    const actual = readDirTree.sync(testDstDir);
    assert.deepEqual(actual, expectedSave);
  });

  it('restores', async() => {
    makeTree(testSrcDir, modifiedFiles);
    makeTree(testDstDir, backupFiles);
    const orig = testSrcDir;
    const back = path.join(testDstDir, 'back');
    await restore(testDstDir, [{orig, back}], {});
    const actual = readDirTree.sync(testSrcDir);
    assert.deepEqual(actual, expectedRestore);
  });

  it('cleans',  async() => {
    makeTree(testDstDir, backupFiles);
    const orig = testSrcDir;
    const back = path.join(testDstDir, 'back');
    await clean(testDstDir, [{orig, back}], {}, []);
    const stat = safeStat(testSrcDir);
    assert.strictEqual(stat, undefined);
  });
});

run();
