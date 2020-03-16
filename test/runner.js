
class Reporter {
  constructor() {
    this.numTests = 0;
    this.numErrors = 0;
  }
  log(...args) {
    console.log(...args);
  }
  pass(...args) {
    ++this.numTests;
    this.log('PASS:', ...args);
  }
  fail(...args) {
    ++this.numTests;
    ++this.numErrors;
    this.log('FAIL:', ...args);
  }
  finish() {
    console.log('================');
    console.log('tests :', this.numTests);
    console.log('passed:', this.numTests - this.numErrors);
    console.log('failed:', this.numErrors);
    return this.numErrors === 0;
  }
}

async function asyncFunction() {};

function isAsyncFunction(fn) {
  return fn.__proto__ === asyncFunction.__proto__;
}

async function runFn(fn) {
  if (isAsyncFunction(fn)) {
    await fn();
  } else {
    this.fn();
  }
}

async function runFuncs(funcs) {
  for (const fn of funcs) {
    await runFn(fn);
  }
}

class Group {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.before = [];
    this.after = [];
    this.beforeEach = [];
    this.afterEach = [];
  }
  addTest(test) {
    this.children.push(test);
  }
  addBefore(fn) {
    this.before.push(fn);
  }
  addAfter(fn) {
    this.after.push(fn);
  }
  addBeforeEach(fn) {
    this.beforeEach.push(fn);
  }
  addAfterEach(fn) {
    this.afterEach.push(fn);
  }
  async run(reporter, prefix = '') {
    reporter.log(prefix, this.name);
    const newPrefix = `  ${prefix}`;

    await runFuncs(this.before);

    for (const child of this.children) {
      await runFuncs(this.beforeEach);
      await child.run(reporter, newPrefix);
      await runFuncs(this.afterEach);
    }

    await runFuncs(this.after);
  } 
};

class Test {
  constructor(name, fn) {
    this.name = name;
    this.fn = fn;
  }
  async run(reporter, prefix = '') {
    reporter.log(prefix, this.name);
    try {
      await runFn(this.fn);
      reporter.pass(this.name);
    } catch (e) {
      reporter.fail(this.name, e);
    }
  }
}

class Runner {
  constructor() {
    this.rootGroup = new Group('*root*');
    this.currentGroup = this.rootGroup;
  }
  addGroup(name, fn) {
    const parentGroup = this.currentGroup;
    this.currentGroup = new Group(name);
    fn();
    parentGroup.addTest(this.currentGroup);
    this.currentGroup = parentGroup;
  }
  addTest(name, fn) {
    this.currentGroup.addTest(new Test(name, fn));
  }
  addBefore(fn) {
    this.currentGroup.addBefore(fn);
  }
  addAfter(fn) {
    this.currentGroup.addAfter(fn);
  }
  addBeforeEach(fn) {
    this.currentGroup.addBeforeEach(fn);
  }
  addAfterEach(fn) {
    this.currentGroup.addAfterEach(fn);
  }
  async run(reporter) {
    await this.rootGroup.run(reporter);
  }
}

const runner = new Runner();

function describe(label, fn) {
  runner.addGroup(label, fn);
}

function it(label, fn) {
  runner.addTest(label, fn);
}

function before(label, fn) {
  runner.addBefore(label, fn);
}

function after(label, fn) {
  runner.addAfter(label, fn);
}

function beforeEach(label, fn) {
  runner.addBeforeEach(label, fn);
}

function afterEach(label, fn) {
  runner.addAfterEach(label, fn);
}

async function run() {
  const reporter = new Reporter();
  await runner.run(reporter);
  reporter.finish();
}

module.exports = {
  describe,
  it,
  run,
  before,
  after,
  beforeEach,
  afterEach,
};