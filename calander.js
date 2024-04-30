import { google } from "googleapis";
import fs from "fs";
import path from "path";

//const KEYFILEPATH = "auth.json";
const CALENDAR_ID = "primary";

const serviceAccountCredentials = JSON.parse(
  fs.readFileSync(path.join("auth.json"), "utf8")
);

// Google Calendar API client setup
const auth = new google.auth.JWT(
  serviceAccountCredentials.client_email,
  null,
  serviceAccountCredentials.private_key,
  [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/admin.directory.resource.calendar",
    "https://www.googleapis.com/auth/cloud-platform",
  ],
  "gil@smartrise.org",
  "111370419970452146902"
);
const calendar = google.calendar({ version: "v3", auth });
console.log("Auth setup complete, proceeding with API calls...");
// Function to check calendar availability
export async function checkDateTimeAvailability(dateTimeToCheck) {
  const startDateTime = new Date(dateTimeToCheck);
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60000); // Check 1 hour range

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDateTime.toISOString(),
      timeMax: endDateTime.toISOString(),
      items: [{ id: CALENDAR_ID }],
    },
  });

  const isAvailable = res.data.calendars[CALENDAR_ID].busy.length === 0;
  console.log(
    `Checking availability for: ${startDateTime.toISOString()} to ${endDateTime.toISOString()}`
  );
  console.log(`Availability: ${isAvailable ? "Available" : "Not available"}`);
  return isAvailable;
}

// // Function to create a calendar event
async function createAppointment(dateTimeToCheck, summary, description, email) {
  if (await checkDateTimeAvailability(dateTimeToCheck)) {
    const event = {
      summary,
      description,
      start: {
        dateTime: dateTimeToCheck,
        timeZone: "America/New_York",
      },
      end: {
        dateTime: new Date(
          new Date(dateTimeToCheck).getTime() + 3600000
        ).toISOString(), // Adds one hour to the start time
        timeZone: "America/New_York",
      },
      attendees: [{ email: email }],
    };

    try {
      const { data } = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        resource: event,
      });

      return data.htmlLink; // Return the link to the created calendar event
    } catch (error) {
      console.error("Error booking appointment:", error);
      throw error;
    }
  } else {
    console.log(
      "Time slot not available, looking for the next available slot..."
    );
    // Find the next available time slot, add an hour and try again:
    const nextAttempt = new Date(new Date(dateTimeToCheck).getTime() + 3600000);
    return createAppointment(
      nextAttempt.toISOString(),
      summary,
      description,
      email
    );
  }
}

// // Example usage of booking an appointment
export async function setupMeeting(dateTime, summary, description, email) {
  try {
    const bookingLink = await createAppointment(
      dateTime,
      summary,
      description,

      email
    );
    console.log(
      `Meeting successfully scheduled, you can join using this link: ${bookingLink}`
    );
  } catch (error) {
    console.error("Failed to schedule the meeting:", error);
  }
}
