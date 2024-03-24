import fetch from "node-fetch";

export const sendTestWebhook = async (userDetails) => {
  const webhookUrl =
    "https://webhook.site/47fb90f3-1b69-4c95-8ba7-9d0803ca2431";
  const data = {
    message: "Request for human help",
    timestamp: new Date().toISOString(),
    userDetails: userDetails, // Include user details in the payload
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const responseBody = await response.text();
    console.log(
      "Successfully sent test webhook with user details:",
      responseBody
    );
    return "Webhook sent successfully";
  } catch (error) {
    console.error("Failed to send test webhook with user details:", error);
  }
};
