export const noExtraSemi = (code, error) => {
  const lines = code.split('\n');
  const targetLine = lines[error.line - 1];
  
  // Remove multiple consecutive semicolons, keeping only one
  const fixedLine = targetLine.replace(/;{2,}/g, ';');
  
  lines[error.line - 1] = fixedLine;
  return lines.join('\n');
};