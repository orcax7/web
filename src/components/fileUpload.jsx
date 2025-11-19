import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import Editor from "@monaco-editor/react";
import "./fileUpload.css";
import ruleDescriptions from "../Utilities/RuleDescription.json";
import { fixerRegistry } from './codeFixer/registry/fixerRegistry';
import { registerAllFixers } from './codeFixer/registry/registerAllFixers';
import CodeHighlighter from './CodeHighlighter';
import { removeUnusedVars } from './codeFixer/removeUnusedVar'
import { eqeqeq } from "./codeFixer/eqeqeq";
import { noExtraSemi } from './codeFixer/noExtraSemi';
import { noTrailingSpaces } from './codeFixer/noTrailingSpaces';
import { eolLast } from './codeFixer/eolLast';
import { semi } from './codeFixer/semi';
import { quotes } from './codeFixer/quotes';
import { MdBuild, MdClose } from 'react-icons/md';

const FileUpload = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);

  const [selectedFileContent, setSelectedFileContent] = useState({});
  const [selectFileEditContent, setSelectFileEditContent] = useState({});
  const [editedFiles, setEditedFiles] = useState([]);

  const [selectedLintContent, setSelectedLintContent] = useState(null);

  const [expandedError, setExpandedError] = useState(null);
  // const [batchProgress, setBatchProgress] = useState(null);
  const [applyingFixes, setApplyingFixes] = useState(new Set());
  const [fixResults, setFixResults] = useState(new Map());
  const [appliedFixes, setAppliedFixes] = useState([]);

  const [originalCodeForDiff, setOriginalCodeForDiff] = useState('');

  const fileInputRef = useRef(null);
  const monacoObjects = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const editorDidMount = (editor, monaco) => {
    monacoObjects.current = { editor, monaco };
  };

  // Handle files from landing page
  useEffect(() => {
    if (location.state?.files) {
      const uploadedFiles = location.state.files;
      setFiles(uploadedFiles);

      // Clear the location state to prevent re-adding files on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Initialize fixer registry on component mount
  useEffect(() => {
    const initializeFixers = async () => {
      try {
        // Register all new fixers
        registerAllFixers();

        // Auto-discover and register all fixers
        await fixerRegistry.autoDiscoverFixers();

        // Register existing fixers manually for backward compatibility
        // These will be replaced by the new fixer system gradually
        const existingFixers = {
          'no-unused-vars': removeUnusedVars,
          'eqeqeq': eqeqeq,
          'no-extra-semi': noExtraSemi,
          'no-trailing-spaces': noTrailingSpaces,
          'eol-last': eolLast,
          'semi': semi,
          'quotes': quotes
        };

        // For now, we'll keep the existing functions available
        // but mark them as registered in the registry
        Object.keys(existingFixers).forEach(ruleId => {
          if (!fixerRegistry.isFixable(ruleId)) {
            console.log(`Marking existing fixer as available: ${ruleId}`);
          }
        });

        console.log('Fixer registry initialized successfully');

        // Make debug function available globally
        window.debugFixers = () => {
          const fixableRules = fixerRegistry.getFixableRules();
          console.log('=== Fixer Registry Debug ===');
          console.log('Total registered fixers:', fixableRules.length);
          console.log('Fixable rules:', fixableRules);

          // Test each fixer
          fixableRules.forEach(ruleId => {
            const fixer = fixerRegistry.getFixer(ruleId);
            console.log(`- ${ruleId}:`, fixer ? 'OK' : 'MISSING');
          });

          return fixableRules;
        };

        console.log('Debug: Type window.debugFixers() in console to see all registered fixers');
      } catch (error) {
        console.error('Failed to initialize fixer registry:', error);
      }
    };

    initializeFixers();
  }, []);

  useEffect(() => {
    if (selectedFileContent?.source === undefined) { return; }

    const { editor } = monacoObjects.current;
    const model = editor.getModel();

    model.setValue(selectedFileContent.source);
  }, [selectedFileContent.source]);

  // Use registry-based approach for checking if a rule is fixable
  const isFixAble = (ruleId) => {
    // First check the registry
    const isInRegistry = fixerRegistry.isFixable(ruleId);

    if (isInRegistry) {
      return true;
    }

    // Fallback to existing fixers for backward compatibility
    const existingFixableRules = [
      'no-unused-vars',
      'eqeqeq',
      'no-extra-semi',
      'no-trailing-spaces',
      'eol-last',
      'semi',
      'quotes',
    ];

    const isInFallback = existingFixableRules.includes(ruleId);

    if (isInFallback) {
      console.log(`Rule ${ruleId} is fixable (from fallback)`);
    } else {
      console.log(`Rule ${ruleId} is NOT fixable`);
    }

    return isInFallback;
  };

  const processFiles = (fileList) => {
    if (fileList.length > 0) {
      const newFiles = Array.from(fileList);

      setFiles((prev) => {
        const updatedFiles = [...newFiles];

        // Check for duplicates and rename if necessary
        updatedFiles.forEach((file, index) => {
          let fileName = file.name;
          let counter = 1;

          // Check if file name exists in previous files or already processed files
          while (prev.some(f => f.name === fileName) ||
            updatedFiles.slice(0, index).some(f => f.name === fileName)) {
            const nameParts = file.name.split('.');
            const extension = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
            const baseName = nameParts.join('.');
            fileName = `${baseName}(${counter})${extension}`;
            counter++;
          }

          // If name was changed, create a new File object with the new name
          if (fileName !== file.name) {
            const renamedFile = new File([file], fileName, { type: file.type });
            updatedFiles[index] = renamedFile;
          }
        });

        return [...prev, ...updatedFiles];
      });
    }
  };

  const handleFileChange = async (event) => {
    processFiles(event.target.files);
    event.target.value = "";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    processFiles(droppedFiles);
  };

  const goToLine = (lineNumber) => {
    if (monacoObjects.current?.editor) {
      monacoObjects.current.editor.revealLineInCenter(lineNumber);
      monacoObjects.current.editor.setPosition({ lineNumber, column: 1 });
      monacoObjects.current.editor.focus();
    }
  }

  const handleUpload = async (file) => {
    setExpandedError(null);
    const formData = new FormData();

    // If there's a selected file with current editor content, use that
    if (file.name && file.source) {
      const codeBlob = new Blob([file.source], { type: "text/plain" });
      const codeFile = new File([codeBlob], file.name, { type: "text/plain" });
      formData.append("files", codeFile);
    }

    try {
      const response = await axios.post(
        "http://localhost:3001/lint",
        // "https://server-yhjj.onrender.com/lint",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      storeLintResult(response.data);
      console.log(response.data);

      for (const message of response.data.lintResult.messages) {
        message.ruleId = message.ruleId?.replace(/^@typescript-eslint\//, "") || "(no rule)";
      }
      const newFile = {
        name: file.name,
        source: response.data.lintResult.output || response.data.lintResult.source
      };
      onSelectFileClick(newFile);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const handleFileClick = (file) => {
    if (file.name === selectedFileContent.name) { return; }

    setAppliedFixes([]);
    setOriginalCodeForDiff('');

    const selectedFile = editedFiles.find((w) => w.name === file.name);
    if (selectedFile) {
      const newFile = {
        name: file.name,
        source: selectedFile.source,
      };

      setSelectedFileContent(newFile);
      handleUpload(newFile);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newFile = {
          name: file.name,
          source: e.target.result,
        };

        setSelectedFileContent(newFile);
        handleUpload(newFile);
      };

      reader.readAsText(file);
    }
  };

  const storeLintResult = (value) => {
    setSelectedLintContent(value);
  }

  const onSelectFileClick = (file) => {
    setSelectFileEditContent(file);
    setEditedFiles((prev) => {
      const exists = prev.some(item => item.name === file.name);
      if (exists) {
        // update the existing item
        return prev.map(item =>
          item.name === file.name ? { ...item, source: file.source } : item
        );
      } else {
        // add new item
        return [...prev, file];
      }
    });
  }

  const applyFix = async (message) => {
    if (!selectFileEditContent.source) return;

    const fixKey = `${message.ruleId}-${message.line}-${message.column}`;

    // Set applying state
    setApplyingFixes(prev => new Set([...prev, fixKey]));
    setFixResults(prev => new Map(prev.set(fixKey, null)));

    // Store original code for diff highlighting 
    if (!originalCodeForDiff) {
      setOriginalCodeForDiff(selectFileEditContent.source);
    }

    let updatedCode = selectFileEditContent.source;

    // Try to get fixer from registry first
    const fixer = fixerRegistry.getFixer(message.ruleId);

    if (fixer) {
      try {
        // Use the new fixer system
        const fixResult = fixer.fix(updatedCode, message);

        if (fixResult.success) {
          updatedCode = fixResult.code;

          // Store successful fix result
          setFixResults(prev => new Map(prev.set(fixKey, fixResult)));

          // Add to applied fixes for highlighting
          const appliedFix = {
            ruleId: message.ruleId,
            line: message.line,
            column: message.column,
            endLine: message.endLine,
            endColumn: message.endColumn,
            message: message.message,
            timestamp: new Date()
          };
          setAppliedFixes(prev => [...prev, appliedFix]);

          if (fixResult.warnings && fixResult.warnings.length > 0) {
            console.warn(`Warnings for ${message.ruleId}:`, fixResult.warnings);
          }
        } else {
          console.warn(`Fix failed for rule ${message.ruleId}: ${fixResult.message}`);

          // Store failed fix result
          setFixResults(prev => new Map(prev.set(fixKey, fixResult)));

          alert(`Fix failed: ${fixResult.message}`);

          // Clear applying state
          setApplyingFixes(prev => {
            const newSet = new Set(prev);
            newSet.delete(fixKey);
            return newSet;
          });
          return;
        }
      } catch (error) {
        console.error(`Error applying fix for rule ${message.ruleId}:`, error);

        // Store error result
        setFixResults(prev => new Map(prev.set(fixKey, {
          success: false,
          message: error.message,
          code: updatedCode
        })));

        alert(`Error applying fix: ${error.message}`);

        // Clear applying state
        setApplyingFixes(prev => {
          const newSet = new Set(prev);
          newSet.delete(fixKey);
          return newSet;
        });
        return;
      }
    } else {
      // Fallback to existing switch-case for backward compatibility
      switch (message.ruleId) {
        case "no-unused-vars":
          updatedCode = removeUnusedVars(updatedCode, message);
          break;
        case "eqeqeq":
          updatedCode = eqeqeq(updatedCode, message);
          break;
        case "no-extra-semi":
          updatedCode = noExtraSemi(updatedCode, message);
          break;
        case "no-trailing-spaces":
          updatedCode = noTrailingSpaces(updatedCode, message);
          break;
        case "eol-last":
          updatedCode = eolLast(updatedCode, message);
          break;
        case "semi":
          updatedCode = semi(updatedCode, message);
          break;
        case "quotes":
          updatedCode = quotes(updatedCode, message);
          break;

        default:
          console.warn(`No automatic fix available for rule: ${message.ruleId}`);

          // Store not-fixable result
          setFixResults(prev => new Map(prev.set(fixKey, {
            success: false,
            message: `No automatic fix available for rule: ${message.ruleId}`,
            code: updatedCode
          })));

          alert(`No automatic fix available for this issue: ${message.ruleId}`);

          // Clear applying state
          setApplyingFixes(prev => {
            const newSet = new Set(prev);
            newSet.delete(fixKey);
            return newSet;
          });
          return;
      }
    }

    try {
      const newFile = {
        name: selectedFileContent.name,
        source: updatedCode
      };

      handleUpload(newFile);

      // Highlight the applied fix in the editor
      if (monacoObjects.current?.editor?.codeHighlighter) {
        const appliedFix = {
          ruleId: message.ruleId,
          line: message.line,
          column: message.column,
          endLine: message.endLine,
          endColumn: message.endColumn,
          message: message.message
        };
        monacoObjects.current.editor.codeHighlighter.addFixHighlight(appliedFix);
      }
    } catch (error) {
      console.error("Error re-linting file:", error);

      // Store error result
      setFixResults(prev => new Map(prev.set(fixKey, {
        success: false,
        message: `Re-linting failed: ${error.message}`,
        code: updatedCode
      })));
    } finally {
      // Clear applying state
      setApplyingFixes(prev => {
        const newSet = new Set(prev);
        newSet.delete(fixKey);
        return newSet;
      });
    }
  };

  const downloadModifiedFile = () => {
    const blob = new Blob([selectFileEditContent.source], {
      type: "text/javascript",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = selectFileEditContent.name.replace(".js", "_fixed.js"); // Append _fixed
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExpand = (ruleId) => {
    setExpandedError((prev) => (prev === ruleId ? null : ruleId));
  };

  const getRuleDetails = (ruleId) => {
    return ruleDescriptions.find((rule) => rule.ruleId === ruleId);
  };

  const handleRemoveFile = (fileToRemove, event) => {
    event.stopPropagation(); // Prevent triggering file click

    // Remove from files list
    setFiles((prevFiles) => prevFiles.filter((file) => file.name !== fileToRemove.name));

    // Remove from edited files
    setEditedFiles((prevFiles) => prevFiles.filter((file) => file.name !== fileToRemove.name));

    // Remove from linting results
    // setLintingResults((prevResults) => prevResults.filter((result) => result.originalname !== fileToRemove.name));

    // Clear selected file if it's the one being removed
    if (selectedFileContent.name === fileToRemove.name) {
      setSelectedFileContent({});
      setSelectedLintContent(null);
      setAppliedFixes([]);
      setOriginalCodeForDiff('');
      setSelectFileEditContent({});
      const { editor } = monacoObjects.current;
      const model = editor.getModel();
      model.setValue('');
    }
  };

  return (
    <div className="container">
      <div className="file-upload-container height-100">
        <div className="file-list">
          <div
            className={`button-container ${isDragging ? 'dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              style={{ display: "none" }}
              ref={fileInputRef}
            />
            คลิกหรือลากไฟล์มาที่นี้เพื่ออัปโหลด
          </div>

          <ul>
            {files.map((file, index) => (
              <li key={index} className={`file-list-item ${selectedFileContent.name == file.name ? "active" : ""
                }`}>
                <button
                  onClick={() => handleFileClick(file)}
                  className="file-button"
                >
                  {file.name}
                </button>
                <button
                  onClick={(e) => handleRemoveFile(file, e)}
                  className="remove-file-button"
                  title="Remove file"
                  aria-label={`Remove ${file.name}`}
                >
                  <MdClose />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="editor-container">
          <Editor
            height="100%"
            theme="vs-dark"
            defaultLanguage="javascript"
            value={selectFileEditContent.source}
            onChange={(value) => {
              setSelectFileEditContent((prev) => ({ ...prev, source: value }));
              setEditedFiles((prevFiles) =>
                prevFiles.map((file) =>
                  file.name === selectedFileContent.name ? { ...file, source: value } : file
                )
              );
              // Clear applied fixes when user manually edits code
              if (appliedFixes.length > 0) {
                setAppliedFixes([]);
                setOriginalCodeForDiff('');
              }
            }}
            options={{
              readOnly: false,
              lineNumbers: "on",
              glyphMargin: true, // Enable glyph margin for fix indicators
              folding: true,
              minimap: { enabled: true },
              overviewRulerBorder: true,
              overviewRulerLanes: 3
            }}
            onMount={editorDidMount}
          />

          {/* Code Highlighter for applied fixes */}
          {monacoObjects.current && (
            <CodeHighlighter
              editor={monacoObjects.current.editor}
              monaco={monacoObjects.current.monaco}
              appliedFixes={appliedFixes}
              originalCode={originalCodeForDiff}
              modifiedCode={selectedFileContent.source}
            />
          )}
        </div>

        <div className="linting-results">
          <div className="flex items-center justify-between">
            <h3>ผลการตรวจสอบ: {selectedLintContent?.lintResult?.errorCount | 0}</h3>
            <div className="flex gap-2">
              {selectedLintContent && (
                <button onClick={() => handleUpload({
                  name: selectFileEditContent.name,
                  source: selectFileEditContent.source
                })}
                  className="btn-analyze">
                  ตรวจสอบ
                </button>
              )}

              {selectedLintContent && (
                <button onClick={() => downloadModifiedFile(selectedLintContent)}
                  className="btn-download">
                  ดาว์นโหลดไฟล์
                </button>
              )}
            </div>
          </div>

          {selectedLintContent?.lintResult?.errorCount > 0 ? (
            <div className="linting-results-container">
              <div className="mt-3">
                {selectedLintContent.lintResult.messages.map((message, idx) => {
                  const ruleDetails = getRuleDetails(message.ruleId);
                  const isRuleFixable = isFixAble(message.ruleId);
                  const fixKey = `${message.ruleId}-${message.line}-${message.column}`;
                  const isApplying = applyingFixes.has(fixKey);
                  const fixResult = fixResults.get(fixKey);

                  return (
                    <div className="lint-result-container" key={idx} style={{
                      borderLeft: isRuleFixable ? '4px solid #4CAF50' : '4px solid #ff9800'
                    }}>
                      <div className={"lint-result-header"}>
                        <div className={"error-toggle truncate"} onClick={() => toggleExpand(idx)}>
                          <span className="text-underline" onClick={(e) => {
                            e.stopPropagation();
                            goToLine(message.line)
                          }}>
                            {message.line}:{message.endColumn}
                          </span>
                          <span >
                            {message.message}
                          </span>
                        </div>

                        {isRuleFixable && (
                          <button
                            title="แก้ไข"
                            className="remove-file-button"
                            onClick={() => applyFix(message)}
                            disabled={isApplying}
                            style={{
                              opacity: isApplying ? 0.6 : 1,
                              cursor: isApplying ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <MdBuild />
                          </button>
                        )}
                      </div>

                      <div className={`error-description ${expandedError === idx ? "active" : ""}`}>
                        {expandedError === idx && ruleDetails && (
                          <>
                            <strong>{ruleDetails.title}</strong>
                            <p>{ruleDetails.description}</p>
                            <p>{ruleDetails.message}</p>
                            {ruleDetails.solution && (
                              <ul>
                                {Object.values(ruleDetails.solution).map((sol, i) => (
                                  <li key={i}>{sol}</li>
                                ))}
                              </ul>
                            )}
                            {ruleDetails.example && (
                              <div className="example-section">
                                <div className="example-block">
                                  <strong className="example-label error-label">ตัวอย่างโค้ดที่ผิด:</strong>
                                  <pre className="example-code error-code">
                                    <code>{ruleDetails.example.error}</code>
                                  </pre>
                                </div>
                                <div className="example-block">
                                  <strong className="example-label fixed-label">ตัวอย่างโค้ดที่ถูกต้อง:</strong>
                                  <pre className="example-code fixed-code">
                                    <code>{ruleDetails.example.fixed}</code>
                                  </pre>
                                </div>
                              </div>
                            )}
                            <div className="text-right">ref: {idx}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p>ไม่พบจุดข้อบกพร่อง</p>
          )}
        </div>
      </div>
    </div >
  );
};

export default FileUpload;
