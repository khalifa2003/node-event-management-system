const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, // مثلا: "smtp.gmail.com"
      port: process.env.EMAIL_PORT, // 465 (secure) أو 587 (starttls)
      secure: process.env.EMAIL_PORT == 465, // true لو 465, false لو 587
      auth: {
        user: process.env.EMAIL_USERNAME, // ايميلك
        pass: process.env.EMAIL_PASSWORD, // الباسورد أو App Password
      },
    });

    await transporter.verify();

    const mailOpts = {
      from: `"App" <${process.env.EMAIL_USERNAME}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
    };

    const info = await transporter.sendMail(mailOpts);
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
};

module.exports = sendEmail;
