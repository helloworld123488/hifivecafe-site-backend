import dotenv from 'dotenv'
dotenv.config()

import axios from 'axios';

import { executeQuery } from '../dbHelper.js';
import logger from '../logger.js';

const accessToken = process.env.FB_ACCESS_TOKEN;
const phoneNumberId = process.env.FB_PHONE_NO_ID;
const graphVersion = process.env.FB_GRAPH_VERSION || 'v25.0';

const cafeNumber = process.env.CAFE_NUMBER;
const cafeName = process.env.CAFE_NAME;

const baseUrl = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}`;

function normalizeWhatsAppNumber(value) {
    const digits = String(value ?? '').replace(/\D/g, '');

    if (/^\d{10}$/.test(digits)) {
        return `91${digits}`;
    }
    if (/^91\d{10}$/.test(digits)) {
        return digits;
    }

    throw new Error('WhatsApp number must be an Indian 10-digit number, optionally prefixed with 91');
}

const authHeaders = () => ({
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
});


// ---------------------------------------------------------------------------
// ONE-TIME SETUP: register the phone number with the WhatsApp Cloud API.
// Do NOT call this on every booking. Run it once (e.g. from a script or a
// protected admin route) after the number is added and verified in Meta.
// ---------------------------------------------------------------------------
export async function registerPhoneNumber(pin = process.env.FB_REGISTER_PIN) {
    if (!/^\d{6}$/.test(String(pin))) {
        throw new Error('Register PIN must be exactly 6 digits (set FB_REGISTER_PIN)');
    }

    try {
        const response = await axios.post(
            `${baseUrl}/register`,
            { messaging_product: 'whatsapp', pin: String(pin) },
            { headers: authHeaders() }
        );
        logger.info(`Route: registerPhoneNumber, Response: ${JSON.stringify(response.data)}`);
        return response.data; // { success: true }
    } catch (error) {
        const detail = error.response ? JSON.stringify(error.response.data) : error.message;
        logger.error(`Route: registerPhoneNumber, Error: ${detail}`);
        throw new Error(`Register failed: ${detail}`);
    }
}


// ---------------------------------------------------------------------------
// Send booking confirmation (template message)
// ---------------------------------------------------------------------------
export async function sendMessage(cus, booking, msgType) {
    let message = '';
    let messageCustomer = cus;

    try {
        messageCustomer = { ...cus, user_mobile: normalizeWhatsAppNumber(cus.user_mobile) };
        const cafeData = { cafeNumber: cafeNumber, cafeName: cafeName };
        const url = `${baseUrl}/messages`;

        logger.info(`Route: sendMessage, booking Parameters: ${JSON.stringify(booking)}`);
        logger.info(`Route: sendMessage, customer Parameters: ${JSON.stringify(messageCustomer)}`);

        if (msgType == "booking") {
            message = 'Booking confirmation';
        }

        const parameters = [
            { type: "text", text: String(cus.user_name) },              // {{1}} customer name
            { type: "text", text: String(booking.booking_id) },         // {{2}}
            { type: "text", text: String(booking.date) },               // {{3}}
            { type: "text", text: String(booking.time_slot) },          // {{4}}
            { type: "text", text: String(booking.total_people) },       // {{5}}
            { type: "text", text: String(booking.celebration_area) },   // {{6}} guessed field name
            { type: "text", text: String(booking.package_name) },       // {{7}} guessed field name
            { type: "text", text: String(booking.cake) },               // {{8}} guessed field name
            { type: "text", text: String(booking.total_amount) },       // {{9}} guessed field name
            { type: "text", text: String(booking.advance_paid) },      // {{10}} guessed field name
            { type: "text", text: String(booking.balance_amount) },    // {{11}} guessed field name
            { type: "text", text: String(cafeData.cafeName) }           // {{12}}
        ];

        logger.info(`Route: sendMessage, After Sending Parameters: ${JSON.stringify(parameters)}`);

        const data = {
            messaging_product: 'whatsapp',
            to: messageCustomer.user_mobile,
            type: 'template',
            template: {
                name: "birthday_confirmation_message",
                language: { code: "en" },
                components: [
                    {
                        type: "header",
                        parameters: [
                            { type: "image", image: { link: process.env.FB_HEADER_IMAGE_URL } }
                        ]
                    },
                    {
                        type: "body",
                        parameters: parameters
                    }
                ]
            }
        };

        try {
            const response = await axios.post(url, data, { headers: authHeaders() });
            console.log('Message sent:', response.data);
            await updateMessageEvent(messageCustomer, booking, 1, message, response.data.contacts[0].wa_id, null);
            return response.data;
        } catch (error) {
            console.log('Error sending message:');
            console.log(error.response ? error.response.data : error.message);
            await updateMessageEvent(messageCustomer, booking, 0, message, null, error.message);
            logger.error(`Route: sendMessage, number: ${messageCustomer.user_mobile}, Error: ${error.message}`);
            return error.message; // same behaviour as before: resolves with the error message
        }
    } catch (err) {
        console.error('Error during message:', err.message || err);
        logger.error(`Route: sendMessage, number: ${messageCustomer.user_mobile}, Error: ${err.message}`);
        return err; // same behaviour as before: resolves with the error
    }
}


async function updateMessageEvent(cus, booking, flg, message, success_id = null, error = null) {
    try {
        const currentdate = new Date();
        const data = [booking.booking_id, cus.user_name, cus.user_mobile, message, flg, success_id, error, currentdate];

        const updation = await executeQuery(
            `INSERT INTO messages (booking_id, cus_name, cus_phone, message, sent_flag, success_id, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            data, "updateMessageEvent"
        );

        if (updation.affectedRows > 0) {
            console.log('Message inserted successfully:', updation);
        } else {
            logger.error(`Route: sendMessage-updateMessageEvent, number: ${cus.user_mobile}, Error: No rows were affected`);
            console.warn('No rows were affected. Please check the query or data.');
        }
    } catch (err) {
        console.error('Error during message insertion:', err.message || err);
        logger.error(`Route: sendMessage-updateMessageEvent, number: ${cus.user_mobile}, Error: ${err.message}`);
    }
}