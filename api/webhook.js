import { google } from "googleapis";

// const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS.replace(/\\n/g, "\n"));

const { client_email, private_key } = credentials;

const auth = new google.auth.JWT(
  client_email,
  null,
  private_key,
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = "1v9z4kEX5k6tpuTg_D7SCoNJubxmTHQjt53a4x7kd6D8";

// 🔹 Normalization helpers
function normalizeEmail(email) {
  if (!email) return "";
  return email
    .replace(/\s+/g, "")
    .replace(/attherate|at\s*the\s*rate/gi, "@")
    .replace(/\s?at\s?/gi, "@")
    .replace(/\sdot\s/gi, ".")
    .replace(/dot/gi, ".")
    .replace(/,+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/@gmail\.com.*$/i, "@gmail.com")
    .toLowerCase();
}

function normalizePhone(phone) {
  return phone ? phone.replace(/\D/g, "") : "";
}

function normalizePropertyType(text) {
  return text ? text.replace(/\b(\d)\s*B\s*H\s*K\b/gi, "$1BHK") : "";
}

function normalizeBudget(budget) {
  if (!budget) return "";
  let cleaned = budget.toLowerCase().trim();
  cleaned = cleaned.replace(/x/gi, "").replace(/[^a-z0-9., ]/gi, "").trim();
  const wordsToNumbers = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const millionMatch = cleaned.match(/(\w+)\s*million/);
  if (millionMatch && wordsToNumbers[millionMatch[1]]) {
    return `$${wordsToNumbers[millionMatch[1]] * 1_000_000}`;
  }
  const numeric = cleaned.match(/\d{4,}/);
  if (numeric) return `$${parseInt(numeric[0]).toLocaleString()}`;
  return budget;
}

// 🔹 Vercel-compatible handler
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const data = req.body;
    const structuredOutputs = data?.message?.artifact?.structuredOutputs || {};
    const firstOutputKey = Object.keys(structuredOutputs)[0];
    const result = structuredOutputs[firstOutputKey]?.result || {};

    const name = result.caller_name || "";
    const phone = normalizePhone(result.caller_phone);
    const email = normalizeEmail(result.caller_email);
    const propertyType = normalizePropertyType(result.propertyType);
    const area = result.area || "";
    const budget = normalizeBudget(result.budget);
    const urgency = result.urgency || "";
    const notes = result.notes || "";
    const role = result.role || "";

    const newRow = [
      new Date().toLocaleString(),
      name,
      phone,
      email,
      propertyType,
      area,
      budget,
      urgency,
      notes,
      role,
      JSON.stringify(result),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:K",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [newRow] },
    });

    console.log("✅ Saved:", newRow);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Error saving data:", err);
    return res.status(500).json({ error: "Error saving data" });
  }
}
