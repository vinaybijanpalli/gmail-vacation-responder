# Gmail Vacation Responder

This Node.js application checks a Gmail mailbox for new, unread emails and sends automated replies to them when the user is on vacation. It also labels these emails and moves them to a designated folder.

## Features

- Checks for new, unread emails in a specified Gmail account
- Sends automated replies to emails without prior responses
- Adds a custom label to the emails and moves them to the label folder
- Operates at random intervals between 45 to 120 seconds

## Prerequisites

Before running this application, you will need:

- Node.js installed on your machine.
- A Google Cloud Platform project with the Gmail API enabled.
- Downloaded credentials for OAuth2 from the Google Developer Console.

For detailed instructions on setting up these prerequisites, follow the steps in the [Gmail API Node.js Quickstart guide](https://developers.google.com/gmail/api/quickstart/nodejs).

## Installation

To set up this project locally, follow these steps:

1. Clone the repository to your local machine:

`git clone https://github.com/vinaybijanpalli/gmail-vacation-responder.git`

2. Navigate to the project directory:

`cd gmail-vacation-responder`

3. Install the required dependencies:

`npm install`

## Usage

To start the application, run:

`node app.js`

This will start the email responder, which will begin checking for new, unread emails and responding to them as configured.

## Configuration

To configure the application for your Gmail account:

1. Place your `credentials.json` file in the project root.
2. Update the `sendReply` function with your name and the date you will be back from vacation.
3. Configure the `createLabel` function with your desired label name.
