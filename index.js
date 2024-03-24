import fs from "fs";
import { promises as fsPromises } from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
import readline from "readline";
import { sendTestWebhook } from "./get_webhook.js";

// Load environment variables from .env file
dotenv.config();

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Async function to create or get existing assistant
async function getOrCreateAssistant() {
  const assistantFilePath = "./assistant.json";
  let assistantDetails;

  try {
    // Check if the assistant.json file exists
    const assistantData = await fsPromises.readFile(assistantFilePath, "utf8");
    assistantDetails = JSON.parse(assistantData);
  } catch (error) {
    // If file does not exist, create a new assistant
    const assistantConfig = {
      name: "Helpful Assistant",
      instructions:
        "I am helpfull assistant, you can chat with me, ask me questions, and upload files for me to use in the future. I can help you with code interpretation and file retrieval.",
      tools: [
        { type: "code_interpreter" },
        {
          type: "function",
          function: {
            name: "sendTestWebhook",
            description:
              "Send a test webhook to Webhook.site with user details",
            parameters: {
              type: "object",
              properties: {
                userDetails: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    phoneNumber: { type: "string" },
                    // Add other user details as needed
                  },
                  required: ["name", "phoneNumber"],
                },
              },
              required: ["userDetails"],
            },
          },
        },
      ],
      model: "gpt-4-1106-preview",
    };

    const assistant = await openai.beta.assistants.create(assistantConfig);
    assistantDetails = { assistantId: assistant.id, ...assistantConfig };

    // Save the assistant details to assistant.json
    await fsPromises.writeFile(
      assistantFilePath,
      JSON.stringify(assistantDetails, null, 2)
    );
  }

  return assistantDetails;
}

const chatWithAssistant = async (question, userDetails) => {
  try {
    // Get or create an assistant
    const assistantDetails = await getOrCreateAssistant();

    // Create a thread using the assistantId
    const thread = await openai.beta.threads.create();

    // Pass in the user question into the existing thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question,
    });

    // Create a run
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantDetails.assistantId,
    });

    // Fetch run-status
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

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
        // Handle other functions similarly
      }

      // Submit the tool outputs
      await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
        tool_outputs: toolOutputs,
      });

      // Update the run status after submitting the outputs
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
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
        console.log({ response: lastMessageForRun.content[0].text.value });
      } else {
        console.log("No response received from the assistant.");
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const getUserDetails = () => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const userDetails = {};

    rl.question("Enter your name: ", (name) => {
      userDetails.name = name;

      rl.question("Enter your phone number: ", (phoneNumber) => {
        userDetails.phoneNumber = phoneNumber;
        rl.close();
        resolve(userDetails);
      });
    });
  });
};

const main = async () => {
  const userDetails = await getUserDetails();
  console.log("User details:", userDetails);

  // Chat with assistant and request human help
  await chatWithAssistant("I need human help", userDetails);
  console.log("Chat with assistant completed.");

  // Send a test webhook with user details
  await sendTestWebhook(userDetails);
  console.log("Test webhook sent successfully.");
};

main();
