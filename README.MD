# Chatbot with OpenAI Assistants API & Function Calling

## Introduction

The chatbot can send a webhook with user details like name and phone number when requested. This is a basic example to demonstrate the functionality of the OpenAI Assistants API.

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

Endpoint
The main endpoint for interacting with the chatbot is /chat.

Request Method
`POST`
`Request URL` yourdomain.com/chat
`Request Body`
The request body should be a JSON object containing the following fields:

`question`: The question to ask the chatbot.
`userDetails`: An object containing user details. For example,
`{ "name": "John Doe", "phoneNumber": "1234567890" }`.

Example request body:

```
{"question":"I need human help","userDetails":{"name":"John Doe","phoneNumber":"1234567890"}}

```

Response
The response will be a JSON object containing the following field:

response: The response from the chatbot.
Example response:

```
{
  "response": "Please provide your name and phone...."
}
```
