import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import { promises as fsPromises } from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
import { sendTestWebhook } from "./get_webhook.js";

// Load environment variables from .env file
dotenv.config();

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const port = 3000;

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

  console.log("Extracted User Details:", userDetails);
  console.log("User Details: ", question, userDetails);

  try {
    const { response } = await chatWithAssistant(question, userDetails); // Destructure the response object
    res.json({ response }); // Send the response directly
    console.log("Response: ", response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
function extractUserDetailsFromQuestion(question) {
  const userDetails = {};

  // Regex patterns
  const namePattern = /name(?: is)?\s*[:\-]?\s*([A-Za-z\s]+)/i;
  const emailPattern = /email(?: is)?\s*[:\-]?\s*([\w\.-]+@[\w\.-]+)/i;
  const phonePattern =
    /phone(?: number)?(?: is)?\s*[:\-]?\s*(\d{10}|\(\d{3}\)\s*\d{3}-\d{4})/i;
  const datePattern =
    /date(?: number)?(?: is)?\s*[:\-]?\s*(\d{10}|\(\d{3}\)\s*\d{3}-\d{4})/i;

  // Extracting details
  const nameMatch = question.match(namePattern);
  const emailMatch = question.match(emailPattern);
  const phoneMatch = question.match(phonePattern);
  const dateMatch = question.match(datePattern);

  if (nameMatch) {
    userDetails.name = nameMatch[1];
  }
  if (emailMatch) {
    userDetails.email = emailMatch[1];
  }
  if (phoneMatch) {
    userDetails.phone = phoneMatch[1];
  }
  if (dateMatch) {
    userDetails.date = dateMatch[1];
  }

  return userDetails;
}
// Async function to  get existing assistant
async function getOrCreateAssistant() {
  const assistantFilePath = "./assistant.json";
  let assistantDetails;

  try {
    // Check if the assistant.json file exists
    const assistantData = await fsPromises.readFile(assistantFilePath, "utf8");
    assistantDetails = JSON.parse(assistantData);
  } catch (error) {
    //Retrive assistant
    const assistant = await openai.beta.assistants.retrieve(
      process.env.ASSISTANT_ID,
      "name",
      "model",
      "instructions",
      "tools"
    );

    assistantDetails = {
      assistantId: assistant.id,
      assistantName: assistant.name,
      assistantInstructions: assistant.instructions,
      assistantModel: assistant.model,
      assistantTools: assistant.tools,
      response_format: { type: "json_object" },
    };

    // Save the assistant details to assistant.json
    await fsPromises.writeFile(
      assistantFilePath,
      JSON.stringify(assistantDetails, null, 2)
    );
  }

  return assistantDetails;
}

async function chatWithAssistant(question, userDetails) {
  try {
    const assistantDetails = await getOrCreateAssistant();

    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantDetails.assistantId,
    });

    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    // Polling for run status
    while (runStatus.status === "in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds before checking again
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Check if the run requires action (e.g., calling a function)
    if (runStatus.status === "requires_action") {
      const toolCalls =
        runStatus.required_action.submit_tool_outputs.tool_calls;

      // Prepare the tool outputs
      const toolOutputs = [];
      for (const toolCall of toolCalls) {
        if (toolCall.function.name === "sendTestWebhook") {
          const output = await sendTestWebhook(userDetails);
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output: output,
          });
        }
      }

      // Submit the tool outputs
      await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
        tool_outputs: toolOutputs,
      });

      // Wait for the run to be completed after submitting the tool outputs
      do {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds before checking again
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      } while (runStatus.status === "in_progress");
    }

    // Handle the final assistant response
    if (runStatus.status === "completed") {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const lastMessageForRun = messages.data
        .filter(
          (message) => message.run_id === run.id && message.role === "assistant"
        )
        .pop();

      if (lastMessageForRun) {
        return { response: lastMessageForRun.content[0].text.value };
      } else {
        console.log("No response received from the assistant.");
        return { response: "No response received from the assistant." };
      }
    } else {
      return { response: "Assistant did not complete the request." };
    }
  } catch (error) {
    console.error(error);
    return { response: "An error occurred while processing your request." };
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
