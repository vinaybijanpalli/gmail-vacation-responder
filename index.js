const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const base64url = require("base64url");
const express = require("express");
const app = express();
const port = 3000;

// Define the scopes
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "token.json");

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

// Load client secrets from a local file.
async function authorize() {
  console.log("Authorizing...");

  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  console.log("Authorized");

  return client;
}

// Get Unreplied messages
async function getUnrepliedMessages(auth) {
  console.log("Getting unreplied messages...");

  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "newer_than:1d -from:me is:unread -label:replied",
  });

  // Filter out messages that have been replied
  const unrepliedMessages = [];
  if (res.data.messages) {
    for (const message of res.data.messages) {
      const messageDetails = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
      });

      const hasReplyPrefix = messageDetails.data.payload.headers.some(
        (header) => header.name === "Subject" && header.value.startsWith("Re:")
      );

      const hasInReplyTo = messageDetails.data.payload.headers.some(
        (header) => header.name === "In-Reply-To"
      );

      if (!hasReplyPrefix && !hasInReplyTo) {
        unrepliedMessages.push(message);
      }
    }
  }

  return unrepliedMessages;
}

// Send Replies
async function sendReply(auth, message) {
  console.log("Sending reply...");

  const gmail = google.gmail({ version: "v1", auth });
  const messageDetails = await gmail.users.messages.get({
    userId: "me",
    id: message.id,
  });

  // Extract subject and threadId from the original message
  const subject = messageDetails.data.payload.headers.find(
    (header) => header.name === "Subject"
  ).value;
  const threadId = messageDetails.data.threadId;

  const replyBody = `Hi,\n\nI am currently out of office on vacation.\nI will be back on Monday. Sorry for the inconvenience.\n\nBest regards,\nVinay`;
  const messageBody = [
    `From: me`,
    `To: ${
      messageDetails.data.payload.headers.find(
        (header) => header.name === "From"
      ).value
    }`,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
    `Subject: ${subject.startsWith("Re:") ? subject : `Re: ${subject}`}`,
    `In-Reply-To: ${message.id}`,
    "",
    replyBody,
  ]
    .join("\n")
    .trim();

  // Send the reply
  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: base64url.encode(messageBody),
      threadId: threadId,
    },
  });

  console.log("Reply sent");

  return response.data;
}

// Create label
async function createLabel(auth, labelName) {
  console.log(`Creating label ${labelName}...`);

  const gmail = google.gmail({ version: "v1", auth });
  try {
    // Check if the label already exists
    const existingLabels = await gmail.users.labels.list({ userId: "me" });
    const existingLabel = existingLabels.data.labels.find(
      (label) => label.name === labelName
    );

    if (existingLabel) {
      console.log(`Label ${labelName} already exists`);
      return existingLabel.id;
    }

    // Create a new label if it doesn't exist
    const label = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });

    console.log(`Label ${labelName} created`);

    return label.data.id;
  } catch (error) {
    console.error("Error creating label:", error);
    throw error;
  }
}

// Add label to the message and move it to the label folder
async function addLabel(auth, message, labelId) {
  console.log(`Adding label ${labelId} to message ${message.id}`);

  const gmail = google.gmail({ version: "v1", auth });
  try {
    await gmail.users.messages.modify({
      userId: "me",
      id: message.id,
      requestBody: {
        addLabelIds: [labelId],
        removeLabelIds: ["INBOX"],
      },
    });

    console.log(`Label ${labelId} added to message ${message.id}`);
  } catch (error) {
    console.error("Error adding label to message:", error);
    throw error;
  }
}

async function main() {
  console.log("Starting email responder...");

  const auth = await authorize();
  const labelName = "Replied";
  const labelId = await createLabel(auth, labelName);
  setInterval(async () => {
    const messages = await getUnrepliedMessages(auth);
    console.log(`${messages.length} messages retrieved`);
    for (let message of messages) {
      await sendReply(auth, message);
      await addLabel(auth, message, labelId);
    }
  }, Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000);
}

// Express server
app.get("/", (req, res) => {
  main().catch(console.error);
  res.send("Email responder is running.");
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
