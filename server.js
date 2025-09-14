const express = require("express")
const { Client, Databases } = require("node-appwrite")
const nodemailer = require("nodemailer")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  console.log(`[v0] ${new Date().toISOString()} - ${req.method} ${req.url}`)
  console.log(`[v0] Headers:`, req.headers)
  next()
})

// Add CORS headers for webhook requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")

  if (req.method === "OPTIONS") {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT)
  .setKey(process.env.APPWRITE_KEY)

const databases = new Databases(client)

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// Utility function to fetch document from collection
async function fetchDocument(collectionId, documentId) {
  try {
    const response = await databases.getDocument(process.env.DB_ID, collectionId, documentId)
    return response
  } catch (error) {
    console.error(`Error fetching document from ${collectionId}:`, error)
    throw error
  }
}

// Build email HTML body
function buildEmailBody(appointment, patient, doctor) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Appointment Notification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 20px; }
        .label { font-weight: bold; color: #555; }
        .value { margin-left: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Appointment Created</h2>
        </div>
        
        <div class="section">
          <h3>Appointment Details</h3>
          <p><span class="label">Schedule:</span><span class="value">${appointment.schedule || "Not specified"}</span></p>
          <p><span class="label">Reason:</span><span class="value">${appointment.reason || "Not specified"}</span></p>
          <p><span class="label">Note:</span><span class="value">${appointment.note || "No additional notes"}</span></p>
        </div>
        
        <div class="section">
          <h3>Patient Information</h3>
          <p><span class="label">Name:</span><span class="value">${patient.name || "Not provided"}</span></p>
          <p><span class="label">Phone:</span><span class="value">${patient.phone || "Not provided"}</span></p>
          <p><span class="label">Address:</span><span class="value">${patient.address || "Not provided"}</span></p>
        </div>
        
        <div class="section">
          <h3>Doctor Information</h3>
          <p><span class="label">Doctor Name:</span><span class="value">${doctor.name || "Not provided"}</span></p>
          <p><span class="label">Clinic Name:</span><span class="value">${doctor.clinicName || "Not provided"}</span></p>
          <p><span class="label">Clinic Address:</span><span class="value">${doctor.clinicAddress || "Not provided"}</span></p>
          <p><span class="label">Clinic Phone:</span><span class="value">${doctor.clinicPhone || "Not provided"}</span></p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Send email using Gmail SMTP
async function sendNotificationEmail(emailBody, appointment, patient, doctor) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: "srujan0701@gmail.com, spawar89069@gmail.com",
      subject: `New Appointment Created - ${patient.name} with Dr. ${doctor.name}`,
      html: emailBody,
      text: `New appointment created for ${patient.name} with Dr. ${doctor.name} on ${appointment.schedule || "TBD"}`,
    }

    const result = await transporter.sendMail(mailOptions)
    console.log("Email sent successfully:", result.messageId)
    return result
  } catch (error) {
    console.error("Error sending email:", error)
    throw error
  }
}

// Main webhook endpoint
app.post("/appointment-created", async (req, res) => {
  try {
    console.log(`[v0] Webhook endpoint hit at ${new Date().toISOString()}`)
    console.log("[v0] Request body:", JSON.stringify(req.body, null, 2))
    console.log("[v0] Request headers:", req.headers)

    // Extract appointment data from webhook payload
    const appointmentData = req.body

    // Check if this is a valid appointment webhook
    if (!appointmentData || !appointmentData.$id) {
      console.log("Invalid webhook payload - missing appointment ID")
      return res.status(400).json({ error: "Invalid webhook payload" })
    }

    // Ignore if token field is not null
    if (appointmentData.token !== null && appointmentData.token !== undefined) {
      console.log("Ignoring appointment with existing token:", appointmentData.token)
      return res.status(200).json({ message: "Appointment ignored - token exists" })
    }

    // Validate required fields
    if (!appointmentData.userId || !appointmentData.doctorId) {
      console.log("Missing required fields: userId or doctorId")
      return res.status(400).json({ error: "Missing required fields: userId or doctorId" })
    }

    console.log(
      `Processing appointment ${appointmentData.$id} for user ${appointmentData.userId} and doctor ${appointmentData.doctorId}`,
    )

    // Fetch patient data
    const patient = await fetchDocument(process.env.PATIENT_COL, appointmentData.userId)
    console.log("Fetched patient data:", patient.name)

    // Fetch doctor data
    const doctor = await fetchDocument(process.env.DOCTOR_COL, appointmentData.doctorId)
    console.log("Fetched doctor data:", doctor.name)

    // Build email body
    const emailBody = buildEmailBody(appointmentData, patient, doctor)

    await sendNotificationEmail(emailBody, appointmentData, patient, doctor)

    console.log(`Successfully processed appointment ${appointmentData.$id}`)
    res.status(200).json({ message: "Email sent" })
  } catch (error) {
    console.error("[v0] Error processing webhook:", error)
    // Log detailed error information
    if (error.response) {
      console.error("Appwrite API Error:", error.response)
    }

    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
    })
  }
})

app.get("/appointment-created", (req, res) => {
  console.log("[v0] GET request to webhook endpoint - this should be POST")
  res.status(405).json({
    error: "Method not allowed",
    message: "This endpoint only accepts POST requests",
    correctUsage: "POST /appointment-created with JSON payload",
  })
})

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Appwrite Webhook Service is running",
    endpoints: {
      webhook: "POST /appointment-created",
      health: "GET /health",
    },
    timestamp: new Date().toISOString(),
  })
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "appwrite-webhook-service",
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err)
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  })
})

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" })
})

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[v0] Appwrite webhook service running on port ${PORT}`)
    console.log(`[v0] Health check available at: http://localhost:${PORT}/health`)
    console.log(`[v0] Webhook endpoint: http://localhost:${PORT}/appointment-created`)
    console.log(`[v0] Root endpoint: http://localhost:${PORT}/`)

    // Log configuration (without sensitive data)
    console.log("Configuration:")
    console.log(`- Appwrite Endpoint: ${process.env.APPWRITE_ENDPOINT}`)
    console.log(`- Project ID: ${process.env.APPWRITE_PROJECT}`)
    console.log(`- Database ID: ${process.env.DB_ID}`)
    console.log(
      `- Collections: Appointment(${process.env.APPOINTMENT_COL}), Patient(${process.env.PATIENT_COL}), Doctor(${process.env.DOCTOR_COL})`,
    )
  })
}

module.exports = app
