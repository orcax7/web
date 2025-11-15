import React, { useEffect, useRef } from 'react';

/**
 * CodeHighlighter Component
 * 
 * Integrates with Monaco Editor to highlight code changes from applied fixes:
 * - Highlights changed code sections
 * - Shows visual indicators for modified lines
 * - Provides diff-style highlighting for before/after comparisons
 * 
 * Requirements: 5.3
 */
const CodeHighlighter = ({ 
  editor, 
  monaco, 
  appliedFixes = [], 
  originalCode = '', 
  modifiedCode = '' 
}) => {
  const decorationsRef = useRef([]);
  const diffDecorationsRef = useRef([]);

  // Clear all decorations
  const clearDecorations = () => {
    if (editor && decorationsRef.current.length > 0) {
      editor.deltaDecorations(decorationsRef.current, []);
      decorationsRef.current = [];
    }
    if (editor && diffDecorationsRef.current.length > 0) {
      editor.deltaDecorations(diffDecorationsRef.current, []);
      diffDecorationsRef.current = [];
    }
  };

  // Highlight applied fixes
  const highlightAppliedFixes = () => {
    if (!editor || !monaco || appliedFixes.length === 0) return;

    const decorations = appliedFixes.map(fix => {
      const startLine = fix.line || 1;
      const endLine = fix.endLine || startLine;
      const startColumn = fix.column || 1;
      const endColumn = fix.endColumn || startColumn + 1;

      return {
        range: new monaco.Range(startLine, startColumn, endLine, endColumn),
        options: {
          className: 'applied-fix-highlight',
          glyphMarginClassName: 'applied-fix-glyph',
          hoverMessage: {
            value: `**Fixed:** ${fix.ruleId}\n\n${fix.message || 'Applied automatic fix'}`
          },
          minimap: {
            color: '#4CAF50',
            position: monaco.editor.MinimapPosition.Inline
          },
          overviewRuler: {
            color: '#4CAF50',
            position: monaco.editor.OverviewRulerLane.Right
          }
        }
      };
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  };

  // Highlight code differences (before/after comparison)
  const highlightCodeDifferences = () => {
    if (!editor || !monaco || !originalCode || !modifiedCode) return;

    const originalLines = originalCode.split('\n');
    const modifiedLines = modifiedCode.split('\n');
    const decorations = [];

    // Simple line-by-line comparison
    const maxLines = Math.max(originalLines.length, modifiedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i] || '';
      const modifiedLine = modifiedLines[i] || '';
      
      if (originalLine !== modifiedLine) {
        // Line was modified
        decorations.push({
          range: new monaco.Range(i + 1, 1, i + 1, modifiedLine.length + 1),
          options: {
            className: 'modified-line-highlight',
            glyphMarginClassName: 'modified-line-glyph',
            hoverMessage: {
              value: `**Modified Line**\n\n**Before:** ${originalLine}\n\n**After:** ${modifiedLine}`
            },
            minimap: {
              color: '#2196F3',
              position: monaco.editor.MinimapPosition.Inline
            }
          }
        });
      }
    }

    diffDecorationsRef.current = editor.deltaDecorations(diffDecorationsRef.current, decorations);
  };

  // Apply custom CSS styles for highlighting
  useEffect(() => {
    if (!monaco) return;

    // Define custom CSS for highlighting
    const style = document.createElement('style');
    style.textContent = `
      /* Applied fix highlighting */
      .applied-fix-highlight {
        background-color: rgba(76, 175, 80, 0.2) !important;
        border: 1px solid rgba(76, 175, 80, 0.4);
        border-radius: 3px;
        animation: fixAppliedPulse 1s ease-out;
      }
      
      .applied-fix-glyph {
        background-color: #4CAF50;
        width: 16px !important;
        height: 16px !important;
        border-radius: 50%;
        margin-left: 2px;
        position: relative;
      }
      
      .applied-fix-glyph::after {
        content: '✓';
        color: white;
        font-size: 10px;
        font-weight: bold;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      
      /* Modified line highlighting */
      .modified-line-highlight {
        background-color: rgba(33, 150, 243, 0.15) !important;
        border-left: 3px solid #2196F3;
        padding-left: 4px;
      }
      
      .modified-line-glyph {
        background-color: #2196F3;
        width: 4px !important;
        height: 100% !important;
        margin-left: 6px;
      }
      
      /* Animation for applied fixes */
      @keyframes fixAppliedPulse {
        0% {
          background-color: rgba(76, 175, 80, 0.4);
          transform: scale(1.02);
        }
        50% {
          background-color: rgba(76, 175, 80, 0.3);
        }
        100% {
          background-color: rgba(76, 175, 80, 0.2);
          transform: scale(1);
        }
      }
      
      /* Dark theme support */
      .monaco-editor.vs-dark .applied-fix-highlight {
        background-color: rgba(76, 175, 80, 0.25) !important;
        border-color: rgba(76, 175, 80, 0.5);
      }
      
      .monaco-editor.vs-dark .modified-line-highlight {
        background-color: rgba(33, 150, 243, 0.2) !important;
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, [monaco]);

  // Update highlights when appliedFixes change
  useEffect(() => {
    highlightAppliedFixes();
  }, [appliedFixes, editor, monaco]);

  // Update diff highlights when code changes
  useEffect(() => {
    if (originalCode && modifiedCode && originalCode !== modifiedCode) {
      highlightCodeDifferences();
    }
  }, [originalCode, modifiedCode, editor, monaco]);

  // Clear decorations on unmount
  useEffect(() => {
    return () => {
      clearDecorations();
    };
  }, []);

  // Expose methods for external control
  useEffect(() => {
    if (editor) {
      editor.codeHighlighter = {
        clearDecorations,
        highlightAppliedFixes,
        highlightCodeDifferences,
        addFixHighlight: (fix) => {
          const decoration = {
            range: new monaco.Range(fix.line, fix.column, fix.endLine || fix.line, fix.endColumn || fix.column + 1),
            options: {
              className: 'applied-fix-highlight',
              glyphMarginClassName: 'applied-fix-glyph',
              hoverMessage: {
                value: `**Fixed:** ${fix.ruleId}\n\n${fix.message || 'Applied automatic fix'}`
              }
            }
          };
          
          const newDecorations = editor.deltaDecorations([], [decoration]);
          decorationsRef.current = [...decorationsRef.current, ...newDecorations];
        }
      };
    }
  }, [editor, monaco]);

  // This component doesn't render anything visible
  return null;
};

export default CodeHighlighter;