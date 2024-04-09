export const sendTestWebhook = async (userDetails) => {
  console.log("User details before sending:", userDetails); // Log the user details before sending

  const webhookUrl =
    "https://hook.us1.make.com/xkc2perqyggk3s9kl4mgrys8zoibjijq";
  const data = {
    message: "Request make an appoiment",
    timestamp: new Date().toISOString(),
    userDetails: userDetails,
  };

  console.log("Sending test webhook with user details:", data);

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
