import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../logger.js';

dotenv.config();

export const sendEmail = async (toEmail, userName = null, htmlMessage = null, subject = null) => {
    return new Promise(async (resolve, reject) => {
        try {
            const emailUser = process.env.EMAIL_USER || 'boopathiperiyasamy2@gmail.com';
            const emailPass = process.env.EMAIL_PASS || 'sscy lujo hrjk yjio';
            const cafeName = process.env.CAFE_NAME || 'HiFive Cafe';

            if (!emailUser || !emailPass) {
                logger.error(`Route: ${subject}, Email: ${toEmail}, Error: Missing EMAIL_USER or EMAIL_PASS environment variables`);
                return resolve('error');
            }

            const transporter = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: emailUser,
                    pass: emailPass,
                },
            });

            if (htmlMessage != "" && htmlMessage != null) {
                const mailOptions = {
                    from: `"${cafeName}" <${emailUser}>`,
                    to: toEmail,
                    subject: subject,
                    html: htmlMessage,
                };

                const info = await transporter.sendMail(mailOptions);
                logger.success(`Route: ${subject}, Email sent to: ${toEmail}, ID: ${info.messageId}`);
                resolve('success');
            } else {
                logger.error(`Route: ${subject}, Email send failed to: ${toEmail}, Message: Message Empty`);
                resolve('error');
            }
        } catch (err) {
            console.error('Error during message:', err.message || err);
            logger.error(`Route: ${subject}, Email: ${toEmail}, Error: ${err.message}`);
            resolve('error');
        }
    });
};


