export const eolLast = (code, error) => {
  // Check if file ends with a newline
  if (!code.endsWith('\n')) {
    // Add newline at the end of file
    return code + '\n';
  }
  
  // File already ends with newline, return as-is
  return code;
};