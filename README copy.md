# AkountSmart - Coming Soon Landing Page

React + Vite frontend with Vercel Serverless API (Node.js) and MongoDB Atlas backend.

---

## Project Structure

```
akountsmart-landing/
├── api/
│   └── waitlist.js          # Vercel serverless function (POST /api/waitlist)
├── public/
│   └── images/
│       ├── logo.png          # <-- Place your logo here
│       └── dashboard-preview.jpeg  # <-- Place the dashboard screenshot here
├── src/
│   ├── components/
│   │   ├── LandingPage.jsx
│   │   └── LandingPage.module.css
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js
├── vercel.json
├── package.json
├── .env.example
└── .gitignore
```

---

## Local Development Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
```
Then edit `.env.local` and add your MongoDB Atlas URI:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
```

### 3. Run locally (frontend only)
```bash
npm run dev
```

To test the API locally too, install the Vercel CLI:
```bash
npm install -g vercel
vercel dev
```
This runs both the frontend and the serverless functions locally.

---

## Add Your Images

Place files in the `public/images/` folder:

| File | Description |
|------|-------------|
| `logo.png` | AkountSmart logo (white version recommended, ~32x32px or SVG) |
| `dashboard-preview.jpeg` | The dashboard screenshot shown below the hero text |

---

## Deploying to Vercel

### Option A: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
```

### Option B: Via GitHub (recommended)
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and click "Add New Project"
3. Import your GitHub repo
4. In the **Environment Variables** section, add:
   - Key: `MONGODB_URI`
   - Value: your MongoDB Atlas connection string
5. Click **Deploy**

Vercel automatically detects Vite and the `api/` folder for serverless functions.

---

## MongoDB Atlas Setup

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free cluster (M0 Sandbox)
3. Under **Database Access**: create a user with read/write access
4. Under **Network Access**: add `0.0.0.0/0` (allow all IPs) for Vercel
5. Click **Connect** > **Connect your application** > copy the URI
6. Replace `<password>` in the URI with your actual password
7. Paste the full URI as `MONGODB_URI` in Vercel environment variables

---

## API Reference

### POST /api/waitlist
Adds an email to the waitlist.

**Request body:**
```json
{ "email": "user@example.com" }
```

**Responses:**
- `201` - Successfully added to waitlist
- `400` - Invalid or missing email
- `409` - Email already on waitlist
- `500` - Server error
