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

const fs = require('fs');
const path = require('path');

function readDirTreeSync(filePath, options) {
  options = options || {};
  if (options.log) {
    options.log(filePath);
  }

  let filter = options.filter;
  if (filter === undefined) {
    filter = () => {
      return true;
    };
  } else if (filter instanceof RegExp) {
    filter = ((filt) => {
      return (filename) => {
        return filt.test(filename);
      };
    })(filter);
  }

  function callFilter(filename) {
    return filter(filename, filePath, fs.statSync(path.join(filePath, filename)).isDirectory());
  }

  let fileNames = fs.readdirSync(filePath).filter(callFilter);

  const subdirFilenames = [];
  fileNames = fileNames.filter((fileName) => {
    const subdirFileName = path.join(filePath, fileName);
    try {
      const stat = fs.statSync(subdirFileName);
      if (stat.isDirectory()) {
        subdirFilenames.push(readDirTreeSync(subdirFileName, options).map((subFileName) => {
          return path.join(fileName, subFileName);
        }));
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  });

  subdirFilenames.forEach((subNames) => {
    fileNames = fileNames.concat(subNames);
  });

  return fileNames;
}

function globToRegex(glob) {
  return glob
    .replace(/\//g, '\\/')
    .replace(/\./g, '\\.')
    .replace(/\?/g, '.')
    .replace(/\*/g, '.*?');
}

function makeIgnoreFunc(ignore) {
  let negate = false;
  let mustBeDir = false;
  if (ignore.substr(0, 1) === '!') {
    negate = true;
    ignore = ignore.substr(1);
  }
  if (ignore.substr(0, 1) === '/') {
    ignore = `^\\/${ignore.substr(1)}`;
  } else {
    ignore = `\\/${ignore}`;
  }
  if (ignore.substr(-1) === '/') {
    mustBeDir = true;
  }
  ignore = globToRegex(ignore);
  if (!mustBeDir && ignore.substr(0, 1) !== '^') {
    ignore += '$';
  }
  const re = new RegExp(ignore);

  return (filename, filePath, isDir) => {
    filename = `/${filename}${isDir ? '/' : ''}`;
    let ig = !re.test(filename);
    if (negate) {
      ig = !ig;
    }
    return ig;
  };
}

function makeIgnoreFilter(ignores) {
  if (!ignores) {
    return () => {
      return true;
    };
  }

  const ignoreFuncs = ignores.map(makeIgnoreFunc);

  return (nativeFilename, filePath, isDir) => {
    const filename = nativeFilename.replace(/\\/g, '/');
    for (let ii = 0; ii < ignoreFuncs.length; ++ii) {
      const ignoreFunc = ignoreFuncs[ii];
      const result = ignoreFunc(filename, filePath, isDir);
      if (!result) {
        return false;
      }
    }
    return true;
  };
}

module.exports = {
  makeIgnoreFilter,
  sync: readDirTreeSync,
};

