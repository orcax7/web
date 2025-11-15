import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import './LandingPage.css';
import { MdClose, MdFilePresent } from 'react-icons/md';

const LandingPage = () => {
  const [files, setFiles] = useState([]);
  const [showRecaptchaModal, setShowRecaptchaModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const recaptchaRef = useRef(null);
  const navigate = useNavigate();

  const processFiles = (fileList) => {
    const newFiles = Array.from(fileList).filter(
      file => file.name.endsWith('.js') || file.name.endsWith('.jsx')
    );

    if (newFiles.length === 0) return;

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
  };

  const handleFileChange = (event) => {
    if (event.target.files.length > 0) {
      processFiles(event.target.files);
    }
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
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  };

  const handleProjectClick = () => {
    if (files.length > 0) {
      // Show reCAPTCHA modal
      setShowRecaptchaModal(true);
    }
  };

  const onRecaptchaChange = (token) => {
    if (token) {
      // Close modal and proceed to editor after successful verification
      setShowRecaptchaModal(false);
      navigate('/editor', { state: { files } });
    }
  };

  const closeModal = () => {
    setShowRecaptchaModal(false);
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="landing-page">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".js,.jsx"
        multiple
        style={{ display: 'none' }}
      />

      {/* Main Content */}
      <div className="landing-content">
        {/* Files Card - Always visible */}
        <div className="files-card"  >
          {files.length > 0 ? (
            <>
              <div className={`files-list ${isDragging ? 'dragging' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {files.map((file, index) => (
                  <div key={index} className="file-item">
                    <div className="file-info">
                      <span className="file-icon">
                        <MdFilePresent />
                      </span>
                      <div className="file-details">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">
                          {(file.size / 1024).toFixed(2)} KB
                        </span>
                      </div>
                    </div>
                    <button
                      className="remove-file"
                      onClick={() => removeFile(index)}
                    >
                      <MdClose />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div onClick={() => fileInputRef.current?.click()}
              className={`empty-state ${isDragging ? 'dragging' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              คลิกที่นี้เพื่ออัปโหลดไฟล์
            </div>
          )}
          <button
            className="start-button"
            onClick={handleProjectClick}
            disabled={files.length == 0}
          >
            เริ่มต้น →
          </button>
        </div>
      </div>

      {/* reCAPTCHA Modal */}
      {showRecaptchaModal && (
        <div className="recaptcha-modal-overlay" onClick={closeModal}>
          <div className="recaptcha-modal" onClick={(e) => e.stopPropagation()}>
            <div className="recaptcha-modal-header">
              <h3>ยืนยันตัวตน</h3>
              <button className="modal-close-btn" onClick={closeModal}>
                <MdClose />
              </button>
            </div>
            <div className="recaptcha-modal-content">
              <p>กรุณายืนยันว่าคุณไม่ใช่โปรแกรมอัตโนมัติ</p>
              <div className="recaptcha-container">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LdpDw0sAAAAANWarKuYcws7UrQBg3kI6mnmbR8m"}
                  onChange={onRecaptchaChange}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
