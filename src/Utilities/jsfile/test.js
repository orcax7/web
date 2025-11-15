// Example JavaScript file with code smells
const a = 5;
a = 6;
// Code smell: Unused variable
const unusedVariable = 'This variable is not used';

// Code smell: Function with too many parameters
function tooManyParameters(param1, param2, param3, param4, param5) {
    // Some code here
}

// Code smell: Duplicate code
function duplicateCodeExample() {
    console.log('This is duplicated in another function');
}

function for_loop() {
    var arr = [0, 5, 63, 5, 7, 8];
    for (var i = 0; i < arr.length; i++) {
        console.log(arr[i]);
    }
}

function anotherFunctionWithDuplicateCode() {
    console.log('This is duplicated in another function');
}

// Code smell: Long function
function longFunction() {
    // Many lines of code here
}

// Code smell: Nested loops
function nestedLoops() {
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
            // Some code here
        }
    }
}

// Code smell: Hardcoded values
const magicNumber = 42;
const result = magicNumber * 2;

// Code smell: Use of eval
const evalExample = eval("console.log('This is eval')");

// Code smell: Complex conditional
function complexConditional(a, b) {
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) {
        // Some code here
    }
}

// Code smell: Unused function
function unusedFunction() {
    console.log('This function is defined but not used');
}

// Code smell: Poor variable naming
const x = 'This variable has a poorly chosen name';

// Code smell: Commented-out code
// console.log('This lin

function aadsfa() { }


var asd = a => 1 ? 2 : 3;
var sh = (a) => 1 ? 2 : 3;

function foreverloop() {
	while(true) {}
}

kkk = 5;