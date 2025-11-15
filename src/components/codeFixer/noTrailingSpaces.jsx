export const noTrailingSpaces = (code, error) => {
  const lines = code.split('\n');
  const targetLine = lines[error.line - 1];
  
  // Remove all trailing whitespace (spaces and tabs) from the line
  const fixedLine = targetLine.replace(/\s+$/, '');
  
  lines[error.line - 1] = fixedLine;
  return lines.join('\n');
};