// Square Appointments page for The Bleuprint Diagnosis: the client picks a
// time, then pays, all in one flow.
const BOOKING_URL =
  "https://book.squareup.com/appointments/3xput23eygv11l/location/LVT88Q22S8H5Y/services/ZQOK37SSFOV3XSNLLUMDTD2F?utm_source=website&utm_medium=redirect&utm_campaign=diagnosis";

// Old pay-first links pointed people at these paths; send them to booking instead.
export function redirectToBooking() {
  return Response.redirect(BOOKING_URL, 302);
}
