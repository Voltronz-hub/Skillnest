const Notification = require('../models/Notification');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Create an email transporter (configure with your email service)
// use createTransport (nodemailer API)
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Function to create an in-app notification
const createNotification = async (userId, type, message, link = null) => {
  try {
    const notification = new Notification({
      user: userId,
      type,
      message,
      link
    });
    await notification.save();
    console.log('Notification created:', notification);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Function to send an email notification
const sendEmailNotification = async (userEmail, subject, text) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject,
      text
    };
    await transporter.sendMail(mailOptions);
    console.log('Email sent to:', userEmail);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

module.exports = {
  createNotification,
  sendEmailNotification
};
