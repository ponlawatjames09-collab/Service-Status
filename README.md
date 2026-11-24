# Innovative Imaging Systems — OR Repair Status Board

Real-time Fluoroscopy & Ultrasound repair status dashboard styled after an Operating Room surgical status monitor, connected automatically to Google Sheets (`PM All` → `CM Record`) without requiring users to log in with Google.

## Deployment Guide: GitHub + Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: IIS OR Repair Status Board"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/new) and import your GitHub repository.
2. Vercel detects `vercel.json` automatically (`npm run build` → `dist/`, serverless functions in `api/`).
3. Add **Environment Variables** in **Project Settings → Environment Variables** (choose one of the two automatic connection methods below):

#### Method A: Google Service Account (Recommended for Private Company Sheets)
1. Enable **Google Sheets API** and **Google Drive API** in Google Cloud Console.
2. Create a **Service Account** and download its JSON key.
3. Open your **`PM All`** Google Sheet → Click **Share** → Add the Service Account email (e.g., `...iam.gserviceaccount.com`) as **Viewer**.
4. Set these Environment Variables in Vercel:
   - `GOOGLE_SPREADSHEET_ID`: The ID from your Google Sheet URL (`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`). *(Optional if `PM All` is shared with the Service Account — the server will auto-discover `PM All` via Drive API)*
   - `GOOGLE_SHEET_NAME`: `CM Record`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: `client_email` from the JSON key
   - `GOOGLE_PRIVATE_KEY`: `private_key` from the JSON key

#### Method B: Link-Shared Sheet (Fastest Setup)
If the `PM All` Google Sheet is set to **"Anyone with the link can view"**:
- Set only `GOOGLE_SPREADSHEET_ID` and `GOOGLE_SHEET_NAME=CM Record` in Vercel Environment Variables (no Service Account key needed).

### 3. Local Development
```bash
npm install
cp .env.example .env
# Fill in GOOGLE_SPREADSHEET_ID (and Service Account credentials if private)
npm run dev
```
The server starts on `http://localhost:3000`.
