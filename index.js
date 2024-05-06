import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import { promises as fsPromises } from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
import { parse, isValid, formatISO } from "date-fns";
import { sendTestWebhook } from "./get_webhook.js";
import cors from "cors";
import { checkDateTimeAvailability, setupMeeting } from "./calander.js";

// Load environment variables from .env file
dotenv.config();

// {
//   "question": "Name Rahees,email raheesahmed256@gmail.com,phone 123456789,date 24/05/2024,time 10:00 PM"
// }

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const assistantID = process.env.ASSISTANT_ID;

const app = express();
const port = 3000;

// Middleware to enable CORS
app.use(cors());

// Middleware to parse JSON bodies
app.use(bodyParser.json());

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Route to handle chat requests
app.post("/chat", async (req, res) => {
  let { question } = req.body;
  // Extract user details from the question
  const userDetails = extractUserDetailsFromQuestion(question);

  console.log("Extracted User Details:", { userDetails });
  console.log("User Details: ", { question }, { userDetails });

  try {
    const response = await chatWithAssistant(question, userDetails); // Destructure the response object
    res.json(response); // Send the response directly
    console.log("Response: ", response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function extractUserDetailsFromQuestion(question) {
  const userDetails = {};

  // Updated regex patterns to match the input format directly
  const namePattern = /Name\s+([^ ]+ [^ ]+)/i; // Captures two words for first name and last name
  const emailPattern = /email\s+([\w.-]+@[\w.-]+)/i;
  const phonePattern = /phone\s+(\d+)/i;
  const datePattern = /date\s+([0-9\/]+)/i; // Matches dates formatted as dd/mm/yyyy
  const timePattern = /time\s+([0-9:]+ [AP]M)/i; // Matches times formatted as hh:mm AM/PM

  // Extracting details
  userDetails.name = question.match(namePattern)?.[1];
  userDetails.email = question.match(emailPattern)?.[1];
  userDetails.phone = question.match(phonePattern)?.[1];
  userDetails.date = question.match(datePattern)?.[1];
  userDetails.time = question.match(timePattern)?.[1];

  return userDetails;
}

// Async function to  get existing assistant
async function getOrCreateAssistant() {
  try {
    // Retrieve the assistant details directly from the OpenAI API
    const assistant = await openai.beta.assistants.retrieve(assistantID);
    const assistantDetails = {
      assistantId: assistant.id,
      assistantName: assistant.name,
      assistantInstructions: assistant.instructions,
      assistantModel: assistant.model,
      assistantTools: assistant.tools,
    };

    //console.log("Assistant Details:", assistantDetails);
    return assistantDetails;
  } catch (error) {
    console.error("Error retrieving the assistant:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

async function chatWithAssistant(question, userDetails) {
  console.log("Chat with assistant started...");
  try {
    const assistantDetails = await getOrCreateAssistant();
    const thread = await openai.beta.threads.create();
    console.log("Thread Created...");
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question,
    });
    console.log("Message Sent...");

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantDetails.assistantId,
    });
    console.log("Run Created...");

    // Pass userDetails to handleRunProcess
    let runStatus = await handleRunProcess(run, thread.id, userDetails);
    console.log("Run processing complete with status:", runStatus.status);

    // Fetch and return the final message from the assistant
    if (runStatus.status === "completed") {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data.find(
        (m) => m.run_id === run.id && m.role === "assistant"
      );
      return { response: lastMessage.content[0].text.value };
    } else {
      console.error("Run did not complete successfully:", runStatus);
      return { response: "Assistant did not complete the request." };
    }
  } catch (error) {
    console.error("An error occurred while processing your request:", error);
    return { response: "An error occurred while processing your request." };
  }
}

async function handleRunProcess(run, threadId, userDetails) {
  let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
  console.log("Checking run Status...");

  // Poll for run status
  while (
    runStatus.status === "in_progress" ||
    runStatus.status === "requires_action"
  ) {
    console.log("Polling for run status...");
    if (
      runStatus.status === "requires_action" &&
      runStatus.required_action &&
      runStatus.required_action.submit_tool_outputs
    ) {
      console.log("Handling Required Actions...");
      await submitToolOutputs(runStatus, threadId, run.id, userDetails);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds before checking again
    runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
  }
  return runStatus;
}

async function submitToolOutputs(runStatus, threadId, runId, userDetails) {
  const toolOutputs =
    runStatus.required_action.submit_tool_outputs.tool_calls.map((toolCall) => {
      const output = handleToolCall(toolCall, userDetails);
      return {
        tool_call_id: toolCall.id,
        output: output,
      };
    });

  await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
    tool_outputs: toolOutputs,
  });
  console.log("Tool outputs submitted successfully.");
}

function handleToolCall(toolCall, userDetails) {
  switch (toolCall.function.name) {
    case "checkDateTimeAvailability":
      const isAvailable = checkDateTimeAvailability(
        userDetails.date,
        userDetails.time
      );
      return JSON.stringify({ available: isAvailable });
    case "createAppointment":
      const appointmentLink = setupMeeting(
        userDetails.date,
        userDetails.time,
        "Appointment",
        "Meeting with Jane Doe",
        userDetails.email
      );
      return JSON.stringify({
        link: appointmentLink || "Failed to create appointment",
      });
    default:
      return JSON.stringify({ error: "Unhandled function call" });
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
