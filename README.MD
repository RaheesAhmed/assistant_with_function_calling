# Chatbot with OpenAI Assistants API & Function Calling

## Introduction

This tutorial will guide you through creating a chatbot using the OpenAI Assistants API. The chatbot can send a webhook with user details like name and phone number when requested. This is a basic example to demonstrate the functionality of the OpenAI Assistants API.

## Prerequisites

Node.js installed on your machine.
An OpenAI API key. You can get one by signing up at OpenAI.
Setting Up Your Project:

```
git clone https://github.com/RaheesAhmed/assistant_with_function_calling.git
```

GO to the Directory:

```
cd assistant_with_function_calling
```

Install Packages:

```
npm install
```

Create a .env file in the root of your project directory and add your OpenAI API key:

```
OPENAI_API_KEY=your_api_key_here
```

Replace your_api_key_here with your actual OpenAI API key.

The `get_webhook.js` File
This file contains the function to send a webhook with user details.

The `index.js` File
This file contains the main logic of the chatbot and the OpenAI assistant.

### Assistant Confrigration

You can set `Assistant Name`,`Instruction` and also `Tools`(Function Calling here):

```
const assistantConfig = {
      name: "Helpful Assistant",
      instructions:
        "I am helpfull assistant, you can chat with me, ask me questions, and upload files for me to use in the future. I can help you with code interpretation and file retrieval.",
      tools: [
        { type: "retrieval" },
        { type: "code_interpreter" },
        {
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
        {
          type: "function",
          function: {
            name: "sendTestEmail",
            description: "Send a test email using Ethereal SMTP",
            parameters: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        },
      ],
      model: "gpt-4-1106-preview",
    };
```
