# EmailJS Setup Instructions

To enable the feedback form, you need to configure EmailJS:

## Steps:

1. **Create an EmailJS Account**
   - Go to https://www.emailjs.com/
   - Sign up for a free account

2. **Create an Email Service**
   - Go to Email Services
   - Click "Add New Service"
   - Choose your email provider (Gmail, Outlook, etc.)
   - Follow the setup instructions

3. **Create an Email Template**
   - Go to Email Templates
   - Click "Create New Template"
   - Use these template variables:
     - `{{from_email}}` - User's email
     - `{{message}}` - User's feedback message
     - `{{to_name}}` - Your name/admin
   - Example template:
     ```
     New Feedback from {{from_email}}
     
     Message:
     {{message}}
     ```

4. **Get Your Credentials**
   - Service ID: Found in Email Services
   - Template ID: Found in Email Templates
   - Public Key: Found in Account > API Keys

5. **Update the Code**
   - Open `src/components/FeedbackModal.jsx`
   - Replace these values (around line 18-20):
     ```javascript
     const serviceId = 'YOUR_SERVICE_ID';
     const templateId = 'YOUR_TEMPLATE_ID';
     const publicKey = 'YOUR_PUBLIC_KEY';
     ```

## Testing

After setup, click the "ส่งความคิดเห็น" button in the navbar to test the feedback form.
