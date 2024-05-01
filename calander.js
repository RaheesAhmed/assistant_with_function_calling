import { google } from "googleapis";
import fs from "fs";
import path from "path";
import {
  parse,
  addHours,
  isValid,
  startOfHour,
  addDays,
  setHours,
} from "date-fns";

const SERVICE_ACCOUNT_PATH = "auth.json";
const TIME_ZONE = "America/New_York";
const APPOINTMENT_DURATION_HOURS = 1;
const CALENDAR_ID = "primary";
const CHECK_DAYS_AHEAD = 7;
const BUSINESS_START_HOUR = 9; // Business hours start at 9 AM
const BUSINESS_END_HOUR = 17; // Business hours end at 5 PM

// Load service account credentials
const serviceAccountCredentials = JSON.parse(
  fs.readFileSync(path.join(SERVICE_ACCOUNT_PATH), "utf8")
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

export const checkDateTimeAvailability = async (
  date,
  numberOfDays = CHECK_DAYS_AHEAD
) => {
  let availableSlots = [];
  let currentDate = startOfHour(new Date(date)); // Start from the beginning of the hour of the provided date

  for (let day = 0; day < numberOfDays; day++) {
    for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
      let startDateTime = setHours(addDays(currentDate, day), hour);
      let endDateTime = addHours(startDateTime, APPOINTMENT_DURATION_HOURS);

      try {
        const response = await calendar.freebusy.query({
          requestBody: {
            timeMin: startDateTime.toISOString(),
            timeMax: endDateTime.toISOString(),
            items: [{ id: CALENDAR_ID }],
            timeZone: TIME_ZONE,
          },
        });

        if (response.data.calendars[CALENDAR_ID].busy.length === 0) {
          availableSlots.push(startDateTime);
        }
      } catch (error) {
        console.error("Error checking availability:", error);
        throw new Error("Failed to check availability");
      }
    }
  }

  return availableSlots;
};

// Function to create a calendar event
export const createAppointment = async (
  dateTime,
  summary,
  description,
  email
) => {
  const isAvailable = await checkDateTimeAvailability(dateTime);
  if (!isAvailable) {
    console.log(
      "Time slot not available, looking for the next available slot..."
    );
    const nextAttempt = addHours(dateTime, APPOINTMENT_DURATION_HOURS);
    return createAppointment(nextAttempt, summary, description, email);
  }

  const event = {
    summary,
    description,
    start: { dateTime: dateTime.toISOString(), timeZone: TIME_ZONE },
    end: {
      dateTime: addHours(dateTime, APPOINTMENT_DURATION_HOURS).toISOString(),
      timeZone: TIME_ZONE,
    },
    attendees: [{ email }],
  };

  try {
    const { data } = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event,
    });
    return data.htmlLink;
  } catch (error) {
    console.error("Error booking appointment:", error);
    throw new Error("Failed to book appointment");
  }
};

// Function to setup a meeting
export const setupMeeting = async (date, time, summary, description, email) => {
  const dateTime = parseDateTime(date, time);
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
};

const parseDateTime = (date, time) => {
  const dateTimeFormats = [
    "dd/MM/yyyy HH:mm",
    "dd/MM/yyyy hh:mm a",
    "dd-MM-yyyy HH:mm",
    "dd-MM-yyyy hh:mm a",
    "yyyy-MM-dd'T'HH:mm:ssX",
  ];

  for (const formatString of dateTimeFormats) {
    const parsedDate = parse(`${date} ${time}`, formatString, new Date());
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }

  throw new Error("Invalid date-time value");
};

// Function to send meeting details to user's email
export const sendMeetingDetails = async (
  meetingLink,
  email,
  meetingDetails
) => {
  const nodemailer = require("nodemailer");

  // Create a transport object
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // or 'STARTTLS'
    auth: {
      user: "gil@smartrise.org",
      pass: "Gil@sapir2309",
    },
  });

  // Define the email message
  const mailOptions = {
    from: "gil@smartrise.org",
    to: email,
    subject: "Meeting Details",
    html: `
      <p>Dear Participant,</p>
      <p>We are pleased to invite you to the following meeting:</p>
      <p><strong>Meeting Details:</strong></p>
      <ul>
        <li><strong>Date:</strong> ${meetingDetails.date}</li>
        <li><strong>Time:</strong> ${meetingDetails.time}</li>
        <li><strong>Agenda:</strong> ${meetingDetails.agenda}</li>
      </ul>
      <p>You can join the meeting using this link: <a href="${meetingLink}">${meetingLink}</a></p>
      <p>We look forward to your participation.</p>
    `,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("Email sent: " + info.response);
  });
};
