export const eqeqeq = (code, error) => {
    const line = error.line;
    const codeLines = code.split("\n");
    const targetLine = codeLines[line - 1];
    const startColumn = error.column - 1;


    const before = targetLine.slice(0, startColumn);
    let after = targetLine.slice(startColumn);

    // Use regex to replace == and != with === and !==
    // Careful to avoid replacing === or !==
    after = after.replace(/(?<![=!])==(?!=)/g, '===');
    after = after.replace(/(?<![=!])!=(?!=)/g, '!==');

    codeLines[line - 1] = before + after;
    return codeLines.join("\n");
}