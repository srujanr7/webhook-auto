const express = require("express")
const { Client, Databases, Query } = require("node-appwrite")
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
    // Return null instead of throwing error for document not found
    if (error.code === 404) {
      console.log(`Document ${documentId} not found in collection ${collectionId}, using fallback data`)
      return null
    }
    throw error
  }
}

async function fetchDocumentByUserId(collectionId, userId) {
  try {
    const response = await databases.listDocuments(process.env.DB_ID, collectionId, [Query.equal("userId", userId)])

    if (response.documents && response.documents.length > 0) {
      console.log(`Found document for userId ${userId} in collection ${collectionId}`)
      return response.documents[0] // Return the first matching document
    } else {
      console.log(`No document found for userId ${userId} in collection ${collectionId}`)
      return null
    }
  } catch (error) {
    console.error(`Error querying collection ${collectionId} for userId ${userId}:`, error)
    return null
  }
}

async function fetchDoctorDocument(collectionId, doctorId) {
  try {
    // First, try to fetch directly as a document ID
    console.log(`[v0] Trying to fetch doctor as document ID: ${doctorId}`)
    const response = await databases.getDocument(process.env.DB_ID, collectionId, doctorId)
    console.log(`[v0] Successfully fetched doctor document directly: ${response.name}`)
    return response
  } catch (error) {
    if (error.code === 404) {
      console.log(`[v0] Doctor not found as document ID, trying as external user ID`)
      try {
        const queryResponse = await databases.listDocuments(process.env.DB_ID, collectionId, [
          Query.equal("doctorId", doctorId),
        ])

        if (queryResponse.documents && queryResponse.documents.length > 0) {
          console.log(`[v0] Found doctor document for doctorId ${doctorId} in collection ${collectionId}`)
          return queryResponse.documents[0]
        } else {
          console.log(`[v0] No doctor document found for doctorId ${doctorId} in collection ${collectionId}`)
          return null
        }
      } catch (queryError) {
        console.error(`[v0] Error querying collection ${collectionId} for doctorId ${doctorId}:`, queryError)
        return null
      }
    } else {
      console.error(`[v0] Error fetching doctor document from ${collectionId}:`, error)
      return null
    }
  }
}

function formatScheduleDate(dateString) {
  if (!dateString) return "Not specified"

  try {
    const date = new Date(dateString)

    // Get individual components
    const day = date.getDate()
    const month = date.toLocaleDateString("en-US", { month: "short" })
    const year = date.getFullYear()
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    // Format: "14 Sept, 2025 at 9:00 AM"
    return `${day} ${month}, ${year} at ${time}`
  } catch (error) {
    console.error("Error formatting date:", error)
    return dateString // Return original if formatting fails
  }
}

// // Build email HTML body
// function buildEmailBody(appointment, patient, doctor) {
//   return `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <meta charset="utf-8">
//       <title>New Appointment Notification</title>
//       <style>
//         body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
//         .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//         .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
//         .section { margin-bottom: 20px; }
//         .label { font-weight: bold; color: #555; }
//         .value { margin-left: 10px; }
//       </style>
//     </head>
//     <body>
//       <div class="container">
//         <div class="header">
//           <h2>New Appointment Created</h2>
//         </div>
        
//         <div class="section">
//           <h3>Appointment Details</h3>
//           <p><span class="label">Appointment ID:</span><span class="value">${appointment.$id}</span></p>
//           <p><span class="label">Schedule:</span><span class="value">${formatScheduleDate(appointment.schedule)}</span></p>
//           <p><span class="label">Reason:</span><span class="value">${appointment.reason || "Not specified"}</span></p>
//           <p><span class="label">Primary Physician:</span><span class="value">${appointment.primaryPhysician || "Not specified"}</span></p>
//           <p><span class="label">Status:</span><span class="value">${appointment.status || "Not specified"}</span></p>
//           <p><span class="label">Note:</span><span class="value">${appointment.note || "No additional notes"}</span></p>
//         </div>
        
//         <div class="section">
//           <h3>Patient Information</h3>
//           <p><span class="label">User ID:</span><span class="value">${appointment.userId}</span></p>
//           <p><span class="label">Name:</span><span class="value">${patient?.name || appointment.name || "Not provided"}</span></p>
//           <p><span class="label">Phone:</span><span class="value">${patient?.phone || appointment.phone || "Not provided"}</span></p>
//           <p><span class="label">Address:</span><span class="value">${patient?.address || appointment.address || "Not provided"}</span></p>
//         </div>
        
//         <div class="section">
//           <h3>Doctor Information</h3>
//           <p><span class="label">Doctor ID:</span><span class="value">${appointment.doctorId}</span></p>
//           <p><span class="label">Doctor Name:</span><span class="value">${doctor?.name || appointment.primaryPhysician || "Not provided"}</span></p>
//           <p><span class="label">Clinic Name:</span><span class="value">${doctor?.clinicName || "Not provided"}</span></p>
//           <p><span class="label">Clinic Address:</span><span class="value">${doctor?.clinicAddress || "Not provided"}</span></p>
//           <p><span class="label">Clinic Phone:</span><span class="value">${doctor?.clinicPhone || "Not provided"}</span></p>
//         </div>
        
//         ${
//           appointment.coupons
//             ? `
//         <div class="section">
//           <h3>Available Coupons</h3>
//           <p><span class="value">${appointment.coupons}</span></p>
//         </div>
//         `
//             : ""
//         }
//       </div>
//     </body>
//     </html>
//   `
// }


// Build email HTML body (single column, compact spacing)
function buildEmailBody(appointment, patient, doctor) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Appointment Notification</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.4;
          color: #333;
          background-color: #f9f9f9;
          padding: 12px;
        }
        .container {
          max-width: 650px;
          margin: 0 auto;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .header, .footer {
          background: #4a90e2;
          color: #fff;
          text-align: center;
        }
        .header {
          padding: 12px;
        }
        .header h2 {
          margin: 0;
          font-size: 18px;
        }
        .footer {
          padding: 8px;
          font-size: 12px;
        }
        .section {
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
        }
        .section:last-child {
          border-bottom: none;
        }
        .section h3 {
          margin: 0 0 6px 0;
          font-size: 15px;
          color: #4a90e2;
        }
        .row {
          margin: 3px 0;
          font-size: 14px;
        }
        .label {
          font-weight: bold;
          color: #555;
          display: inline-block;
          width: 130px;
        }
        .value {
          color: #000;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Appointment Created</h2>
        </div>
        
        <div class="section">
          <h3>📅 Appointment Details</h3>
          <div class="row"><span class="label">Appointment ID:</span><span class="value">${appointment.$id}</span></div>
          <div class="row"><span class="label">Schedule:</span><span class="value">${formatScheduleDate(appointment.schedule)}</span></div>
          <div class="row"><span class="label">Reason:</span><span class="value">${appointment.reason || "Not specified"}</span></div>
          <div class="row"><span class="label">Primary Physician:</span><span class="value">${appointment.primaryPhysician || "Not specified"}</span></div>
          <div class="row"><span class="label">Status:</span><span class="value">${appointment.status || "Not specified"}</span></div>
          <div class="row"><span class="label">Note:</span><span class="value">${appointment.note || "No additional notes"}</span></div>
        </div>
        
        <div class="section">
          <h3>👤 Patient Information</h3>
          <div class="row"><span class="label">Name:</span><span class="value">${patient?.name || appointment.name || "Not provided"}</span></div>
          <div class="row"><span class="label">Phone:</span><span class="value">${patient?.phone || appointment.phone || "Not provided"}</span></div>
          <div class="row"><span class="label">Address:</span><span class="value">${patient?.address || appointment.address || "Not provided"}</span></div>
        </div>
        
        <div class="section">
          <h3>🩺 Doctor Information</h3>
          <div class="row"><span class="label">Doctor Name:</span><span class="value">${doctor?.name || appointment.primaryPhysician || "Not provided"}</span></div>
          <div class="row"><span class="label">Clinic Name:</span><span class="value">${doctor?.clinicName || "Not provided"}</span></div>
          <div class="row"><span class="label">Clinic Address:</span><span class="value">${doctor?.clinicAddress || "Not provided"}</span></div>
          <div class="row"><span class="label">Clinic Phone:</span><span class="value">${doctor?.clinicPhone || "Not provided"}</span></div>
        </div>

        <div class="footer">
          doctorsClub © 2025
        </div>
      </div>
    </body>
    </html>
  `;
}


// Send email using Gmail SMTP
async function sendNotificationEmail(emailBody, appointment, patient, doctor) {
  try {
    const patientName = patient?.name || appointment.name || "Unknown Patient"
    const doctorName = doctor?.name || appointment.primaryPhysician || "Unknown Doctor"

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: "srujan0701@gmail.com, spawar89069@gmail.com",
      subject: `📅 doctorsClub Notifications - New Appointment for Dr. ${doctorName}`,
      html: emailBody,
      text: `New appointment created for ${patientName} with Dr. ${doctorName} on ${formatScheduleDate(appointment.schedule)}`,
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
    let patient = null
    let doctor = null

    try {
      patient = await fetchDocumentByUserId(process.env.PATIENT_COL, appointmentData.userId)
      if (patient) {
        console.log("Fetched patient data:", patient.name, patient.phone, patient.address)
      } else {
        console.log("Patient document not found, using appointment data")
      }
    } catch (error) {
      console.log("Failed to fetch patient data, continuing with appointment data only")
    }

    // Fetch doctor data
    try {
      doctor = await fetchDoctorDocument(process.env.DOCTOR_COL, appointmentData.doctorId)
      if (doctor) {
        console.log("Fetched doctor data:", doctor.name, doctor.clinicName, doctor.clinicAddress)
      } else {
        console.log("Doctor document not found, using appointment data")
      }
    } catch (error) {
      console.log("Failed to fetch doctor data, continuing with appointment data only")
    }

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
