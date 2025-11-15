import { useState, useRef } from 'react';
import { MdClose } from 'react-icons/md';
import emailjs from '@emailjs/browser';
import './FeedbackModal.css';

const FeedbackModal = ({ isOpen, onClose }) => {
  const formRef = useRef();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Replace these with your EmailJS credentials
      const serviceId = 'service_ocv5c8h';
      const templateId = 'template_ag31x0r';
      const publicKey = 'KyzM3FrzdmbeoLt2J';

      await emailjs.sendForm(serviceId, templateId, formRef.current, publicKey);

      setSubmitStatus('success');
      setEmail('');
      setMessage('');

      setTimeout(() => {
        onClose();
        setSubmitStatus(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to send feedback:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="feedback-modal-overlay" onClick={onClose}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-modal-header">
          <h2>ส่งความคิดเห็น</h2>
          <button className="feedback-close-btn" onClick={onClose}>
            <MdClose />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="feedback-form" ref={formRef}>
          <div className="form-group">
            <label htmlFor="email">อีเมล</label>
            <input
              type="email"
              id="email"
              name="from_name"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="message">ข้อความ</label>
            <textarea
              id="message" 
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="แบ่งปันความคิดเห็นของคุณ..."
              rows="6"
              required
              disabled={isSubmitting}
            />
          </div>

          {submitStatus === 'success' && (
            <div className="feedback-status success">
              ส่งความคิดเห็นสำเร็จ! ขอบคุณครับ
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="feedback-status error">
              เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง
            </div>
          )}

          <button
            type="submit"
            className="feedback-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'กำลังส่ง...' : 'ส่งความคิดเห็น'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;
