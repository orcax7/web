/**
 * Test fixtures for ESLint auto-fix testing
 * Contains input code samples and expected outputs for various rules
 */

export const fixtures = {
  // Comma dangle fixtures
  'comma-dangle': {
    basic: {
      input: `const obj = {
  a: 1,
  b: 2,
}`,
      expected: `const obj = {
  a: 1,
  b: 2
}`,
      description: 'Remove trailing comma from object'
    },
    array: {
      input: `const arr = [
  1,
  2,
  3,
]`,
      expected: `const arr = [
  1,
  2,
  3
]`,
      description: 'Remove trailing comma from array'
    },
    nested: {
      input: `const complex = {
  obj: {
    a: 1,
    b: 2,
  },
  arr: [
    1,
    2,
  ],
}`,
      expected: `const complex = {
  obj: {
    a: 1,
    b: 2
  },
  arr: [
    1,
    2
  ]
}`,
      description: 'Remove trailing commas from nested structures'
    },
    singleLine: {
      input: `const obj = { a: 1, b: 2, }`,
      expected: `const obj = { a: 1, b: 2 }`,
      description: 'Remove trailing comma from single-line object'
    }
  },

  // Indentation fixtures
  'indent': {
    basic: {
      input: `function test() {
if (true) {
console.log('hello');
}
}`,
      expected: `function test() {
  if (true) {
    console.log('hello');
  }
}`,
      description: 'Fix basic indentation issues'
    },
    nested: {
      input: `if (true) {
if (false) {
if (maybe) {
console.log('deeply nested');
}
}
}`,
      expected: `if (true) {
  if (false) {
    if (maybe) {
      console.log('deeply nested');
    }
  }
}`,
      description: 'Fix nested block indentation'
    },
    object: {
      input: `const obj = {
a: 1,
b: {
c: 2,
d: 3
},
e: 4
}`,
      expected: `const obj = {
  a: 1,
  b: {
    c: 2,
    d: 3
  },
  e: 4
}`,
      description: 'Fix object property indentation'
    },
    array: {
      input: `const arr = [
1,
2,
[
3,
4
],
5
]`,
      expected: `const arr = [
  1,
  2,
  [
    3,
    4
  ],
  5
]`,
      description: 'Fix array element indentation'
    },
    mixed: {
      input: `function test() {
\tif (true) {
  console.log('mixed tabs and spaces');
\t\tconsole.log('more mixed');
  }
}`,
      expected: `function test() {
  if (true) {
    console.log('mixed tabs and spaces');
    console.log('more mixed');
  }
}`,
      description: 'Fix mixed tabs and spaces'
    }
  },

  // No-var fixtures
  'no-var': {
    basic: {
      input: `var x = 1;
var y = 2;`,
      expected: `let x = 1;
let y = 2;`,
      description: 'Convert var to let'
    },
    multiple: {
      input: `var a = 1, b = 2, c;`,
      expected: `let a = 1, b = 2, c;`,
      description: 'Convert multiple var declarations'
    },
    forLoop: {
      input: `for (var i = 0; i < 10; i++) {
  console.log(i);
}`,
      expected: `for (let i = 0; i < 10; i++) {
  console.log(i);
}`,
      description: 'Convert var in for loop'
    },
    destructuring: {
      input: `var { a, b } = obj;
var [x, y] = arr;`,
      expected: `let { a, b } = obj;
let [x, y] = arr;`,
      description: 'Convert var with destructuring'
    },
    scoped: {
      input: `function test() {
  var x = 1;
  if (true) {
    var y = 2;
  }
  var z = 3;
}`,
      expected: `function test() {
  let x = 1;
  if (true) {
    let y = 2;
  }
  let z = 3;
}`,
      description: 'Convert var in different scopes'
    }
  },

  // Prefer-const fixtures
  'prefer-const': {
    basic: {
      input: `let x = 1;
console.log(x);`,
      expected: `const x = 1;
console.log(x);`,
      description: 'Convert let to const for never reassigned variable'
    },
    multiple: {
      input: `let a = 1, b = 2;
console.log(a, b);`,
      expected: `const a = 1, b = 2;
console.log(a, b);`,
      description: 'Convert multiple let declarations to const'
    },
    destructuring: {
      input: `let { a, b } = obj;
let [x, y] = arr;
console.log(a, b, x, y);`,
      expected: `const { a, b } = obj;
const [x, y] = arr;
console.log(a, b, x, y);`,
      description: 'Convert destructuring let to const'
    },
    mixed: {
      input: `let x = 1;
let y = 2;
y = 3;
console.log(x, y);`,
      expected: `const x = 1;
let y = 2;
y = 3;
console.log(x, y);`,
      description: 'Convert only non-reassigned variables'
    }
  },

  // No-console fixtures
  'no-console': {
    basic: {
      input: `console.log('debug message');
console.error('error message');`,
      expected: `// console.log('debug message');
// console.error('error message');`,
      description: 'Comment out console statements'
    },
    methods: {
      input: `console.log('log');
console.warn('warn');
console.error('error');
console.info('info');
console.table(data);`,
      expected: `// console.log('log');
// console.warn('warn');
// console.error('error');
// console.info('info');
// console.table(data);`,
      description: 'Comment out various console methods'
    },
    complex: {
      input: `console.log('User:', user.name, 'Age:', user.age);
console.log(data.map(x => x.name).join(', '));`,
      expected: `// console.log('User:', user.name, 'Age:', user.age);
// console.log(data.map(x => x.name).join(', '));`,
      description: 'Comment out complex console statements'
    },
    indented: {
      input: `function debug() {
  console.log('inside function');
  if (true) {
    console.error('inside if');
  }
}`,
      expected: `function debug() {
  // console.log('inside function');
  if (true) {
    // console.error('inside if');
  }
}`,
      description: 'Preserve indentation when commenting'
    }
  },

  // Curly fixtures
  'curly': {
    if: {
      input: `if (true) console.log('test');`,
      expected: `if (true) {
  console.log('test');
}`,
      description: 'Add braces to if statement'
    },
    else: {
      input: `if (true) {
  console.log('if');
} else console.log('else');`,
      expected: `if (true) {
  console.log('if');
} else {
  console.log('else');
}`,
      description: 'Add braces to else statement'
    },
    while: {
      input: `while (true) console.log('loop');`,
      expected: `while (true) {
  console.log('loop');
}`,
      description: 'Add braces to while loop'
    },
    for: {
      input: `for (let i = 0; i < 10; i++) console.log(i);`,
      expected: `for (let i = 0; i < 10; i++) {
  console.log(i);
}`,
      description: 'Add braces to for loop'
    },
    nested: {
      input: `if (true) if (false) console.log('nested');`,
      expected: `if (true) {
  if (false) {
    console.log('nested');
  }
}`,
      description: 'Add braces to nested statements'
    },
    multiline: {
      input: `if (condition)
  console.log('multiline');`,
      expected: `if (condition) {
  console.log('multiline');
}`,
      description: 'Add braces to multiline statement'
    }
  },

  // Brace-style fixtures
  'brace-style': {
    if: {
      input: `if (true)
{
  console.log('test');
}`,
      expected: `if (true) {
  console.log('test');
}`,
      description: 'Fix if statement brace style'
    },
    function: {
      input: `function test()
{
  return true;
}`,
      expected: `function test() {
  return true;
}`,
      description: 'Fix function brace style'
    },
    class: {
      input: `class MyClass
{
  constructor() {
    this.name = 'test';
  }
}`,
      expected: `class MyClass {
  constructor() {
    this.name = 'test';
  }
}`,
      description: 'Fix class brace style'
    },
    else: {
      input: `if (true) {
  console.log('if');
}
else {
  console.log('else');
}`,
      expected: `if (true) {
  console.log('if');
} else {
  console.log('else');
}`,
      description: 'Fix else brace style'
    },
    tryCatch: {
      input: `try
{
  riskyOperation();
}
catch (error)
{
  console.error(error);
}`,
      expected: `try {
  riskyOperation();
} catch (error) {
  console.error(error);
}`,
      description: 'Fix try-catch brace style'
    }
  },

  // Space-before-blocks fixtures
  'space-before-blocks': {
    if: {
      input: `if (true){
  console.log('test');
}`,
      expected: `if (true) {
  console.log('test');
}`,
      description: 'Add space before if block'
    },
    function: {
      input: `function test(){
  return true;
}`,
      expected: `function test() {
  return true;
}`,
      description: 'Add space before function block'
    },
    class: {
      input: `class MyClass{
  constructor() {
    this.name = 'test';
  }
}`,
      expected: `class MyClass {
  constructor() {
    this.name = 'test';
  }
}`,
      description: 'Add space before class block'
    },
    arrow: {
      input: `const fn = () =>{
  return true;
}`,
      expected: `const fn = () => {
  return true;
}`,
      description: 'Add space before arrow function block'
    },
    multiple: {
      input: `if (true)   {
  console.log('test');
}`,
      expected: `if (true) {
  console.log('test');
}`,
      description: 'Normalize multiple spaces to single space'
    }
  },

  // Quotes fixtures
  'quotes': {
    single: {
      input: `const str = "hello world";
const template = "Hello, " + name + "!";`,
      expected: `const str = 'hello world';
const template = 'Hello, ' + name + '!';`,
      description: 'Convert double quotes to single quotes'
    },
    escaped: {
      input: `const str = "It's a beautiful day";`,
      expected: `const str = 'It\\'s a beautiful day';`,
      description: 'Handle escaped quotes'
    },
    mixed: {
      input: `const a = "first";
const b = 'second';
const c = "third";`,
      expected: `const a = 'first';
const b = 'second';
const c = 'third';`,
      description: 'Normalize mixed quote styles'
    }
  },

  // Semi fixtures
  'semi': {
    basic: {
      input: `const x = 1
const y = 2`,
      expected: `const x = 1;
const y = 2;`,
      description: 'Add missing semicolons'
    },
    function: {
      input: `function test() {
  return true
}`,
      expected: `function test() {
  return true;
}`,
      description: 'Add semicolon to return statement'
    },
    object: {
      input: `const obj = {
  method() {
    return this.value
  }
}`,
      expected: `const obj = {
  method() {
    return this.value;
  }
};`,
      description: 'Add semicolons to object methods and declaration'
    }
  }
}

/**
 * Complex scenarios combining multiple rules
 */
export const complexFixtures = {
  multiRule: {
    input: `var x = 1
let y = 2
if (true) console.log(x, y)
console.log("debug")`,
    expected: `const x = 1;
const y = 2;
if (true) {
  console.log(x, y);
}
// console.log('debug');`,
    rules: ['semi', 'no-var', 'prefer-const', 'curly', 'no-console', 'quotes'],
    description: 'Multiple rules applied in sequence'
  },
  
  realWorld: {
    input: `var users = [
{name: "John", age: 30,},
{name: "Jane", age: 25,}
]

function processUsers() {
if (users.length > 0) console.log("Processing users")
for (var i = 0; i < users.length; i++) {
let user = users[i]
console.log("User: " + user.name)
}
}`,
    expected: `const users = [
  {name: 'John', age: 30},
  {name: 'Jane', age: 25}
];

function processUsers() {
  if (users.length > 0) {
    // console.log('Processing users');
  }
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    // console.log('User: ' + user.name);
  }
}`,
    rules: ['indent', 'comma-dangle', 'semi', 'no-var', 'prefer-const', 'curly', 'no-console', 'quotes'],
    description: 'Real-world code example with multiple issues'
  }
}

/**
 * Edge cases and error scenarios
 */
export const edgeCases = {
  emptyFile: {
    input: '',
    expected: '',
    description: 'Empty file should remain empty'
  },
  
  onlyComments: {
    input: `// This is a comment
/* Multi-line
   comment */`,
    expected: `// This is a comment
/* Multi-line
   comment */`,
    description: 'File with only comments should remain unchanged'
  },
  
  malformedCode: {
    input: `const x = {
  a: 1,
  b: 2
  // missing closing brace`,
    expected: null, // Should not be fixable
    description: 'Malformed code should not be fixed'
  },
  
  stringWithCode: {
    input: `const code = "var x = 1; console.log(x);";`,
    expected: `const code = 'var x = 1; console.log(x);';`,
    description: 'Code inside strings should not be fixed (except quotes)'
  },
  
  templateLiteral: {
    input: `const template = \`
function test() {
var x = 1
console.log(x)
}
\`;`,
    expected: `const template = \`
function test() {
var x = 1
console.log(x)
}
\`;`,
    description: 'Code inside template literals should not be fixed'
  },
  
  regexLiteral: {
    input: `const regex = /var\\s+\\w+\\s*=/g;`,
    expected: `const regex = /var\\s+\\w+\\s*=/g;`,
    description: 'Code patterns in regex should not be fixed'
  }
}

/**
 * Performance test fixtures
 */
export const performanceFixtures = {
  large: {
    input: Array(1000).fill(`var x = 1\nconsole.log(x)`).join('\n'),
    description: 'Large file with repeated patterns'
  },
  
  deeplyNested: {
    input: Array(50).fill(0).reduce((code, _, i) => 
      `${code}if (condition${i}) {\n`, 'function test() {\n') + 
      'console.log("deeply nested");\n' + 
      Array(51).fill('}').join('\n'),
    description: 'Deeply nested code structure'
  }
}

export default fixtures