export function bookingMessage(cus, booking, cafe) {

let message = `Booking Notification: Your booking for ${booking.sub_title} has been confirmed.

Booking Details:
- Booking ID: ${booking.booking_id}
- Date: ${booking.date}
- Time Slot: ${booking.time_slot}
- Guests: ${booking.total_people}

If you have any questions or need assistance, feel free to contact ${cafe.cafeName} at ${cafe.cafeNumber} anytime.`;

    return message;
}