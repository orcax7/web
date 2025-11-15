import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdCode, MdFeedback } from 'react-icons/md';
import FeedbackModal from './FeedbackModal';
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <>
      <nav className="navbar">
        <button 
          className="navbar-logo-btn" 
          onClick={handleLogoClick}
          aria-label="Go to home"
        >
          <MdCode className="navbar-icon" />
        </button>

        <button 
          className="navbar-feedback-btn" 
          onClick={() => setIsFeedbackOpen(true)}
          aria-label="Send feedback"
        >
          <MdFeedback className="navbar-feedback-icon" />
          <span>ส่งความคิดเห็น</span>
        </button>
      </nav>

      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />
    </>
  );
};

export default Navbar;
