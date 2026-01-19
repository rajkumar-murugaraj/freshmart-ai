<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## SMS (Twilio) setup and testing

1. Copy `.env.example` to `.env` and fill in your Twilio credentials:

   - `TWILIO_ACCOUNT_SID` — your Twilio account SID
   - `TWILIO_AUTH_TOKEN` — your Twilio auth token
   - `TWILIO_FROM` — a Twilio phone number you own (E.164 format, e.g. `+1234567890`)
   - `ADMIN_SMS` — admin phone (defaults to `9342277609`)

2. If you are using a Twilio trial account, verify destination numbers in the Twilio Console.

3. Start the backend (server reads `.env` on startup):

   ```powershell
   node server.js
   ```

4. Run the test SMS client (sends a test SMS to `ADMIN_SMS` or the phone in `scripts/test-sms-client.js`):

   ```powershell
   npm run test-sms
   ```

5. Check the server console for success logs (`Admin SMS sent: <SID>`) or errors.

Notes:
- If you do not provide Twilio credentials, the server will only log SMS payloads (no real SMS sent).
- For production use, keep `.env` out of source control and secure your credentials.

