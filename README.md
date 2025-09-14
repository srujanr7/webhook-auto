# Appwrite Webhook Service

A Node.js API service that integrates with Appwrite to handle appointment creation webhooks and send email notifications.

## Features

- Receives Appwrite webhooks when new appointments are created
- Fetches related patient and doctor data from Appwrite database
- Sends formatted email notifications using Appwrite Messaging API
- Production-ready with proper error handling and logging
- Health check endpoint for monitoring

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Copy environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Update `.env` with your Appwrite credentials:
   - Replace `your_api_key_here` with your actual Appwrite API key
   - Verify all other environment variables match your Appwrite project

4. Start the service:
   \`\`\`bash
   # Development
   npm run dev
   
   # Production
   npm start
   \`\`\`

## API Endpoints

### POST /appointment-created
Webhook endpoint for Appwrite appointment creation events.

**Request Body:** Appwrite webhook payload containing appointment data

**Response:**
- `200`: Email sent successfully
- `400`: Invalid request or missing required fields
- `500`: Internal server error

### GET /health
Health check endpoint for monitoring service status.

**Response:**
\`\`\`json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "appwrite-webhook-service"
}
\`\`\`

## Webhook Configuration

In your Appwrite console:

1. Go to your project settings
2. Navigate to Webhooks
3. Create a new webhook with:
   - **Name:** Appointment Created
   - **URL:** `https://your-domain.com/appointment-created`
   - **Events:** `databases.*.collections.6831e6e3002147d634da.documents.*.create`
   - **HTTP Method:** POST

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `APPWRITE_ENDPOINT` | Appwrite API endpoint | `https://cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT` | Your Appwrite project ID | `6831d243002519e375d1` |
| `APPWRITE_KEY` | Appwrite API key with required permissions | `your_api_key_here` |
| `DB_ID` | Database ID | `6831daa90007d85d7e2e` |
| `APPOINTMENT_COL` | Appointment collection ID | `6831e6e3002147d634da` |
| `PATIENT_COL` | Patient collection ID | `6831daba000fa440033c` |
| `DOCTOR_COL` | Doctor collection ID | `6831e5ae0001295b7078` |
| `PORT` | Server port (optional) | `3000` |
| `NODE_ENV` | Environment mode | `production` |

## Required Appwrite Permissions

Your API key needs the following permissions:
- `databases.read` - To fetch patient and doctor data
- `messages.write` - To send email notifications

## Deployment

This service can be deployed to any Node.js hosting platform:

- **Vercel:** Add as a serverless function
- **Railway:** Connect your GitHub repository
- **Heroku:** Use the included `package.json`
- **DigitalOcean App Platform:** Deploy directly from Git

Make sure to set all environment variables in your deployment platform.

## Error Handling

The service includes comprehensive error handling:
- Invalid webhook payloads are rejected with 400 status
- Missing patient/doctor data is logged and returns 500 status
- Email sending failures are logged with detailed error information
- All errors include appropriate HTTP status codes and messages

## Logging

The service logs:
- Incoming webhook payloads
- Processing steps (patient/doctor data fetching)
- Email sending success/failure
- Error details for debugging

In production, sensitive information is excluded from error responses.
