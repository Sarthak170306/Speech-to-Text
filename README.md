# 🎙️ AI Real-time Voice Transcriber & Analytics Dashboard

---

## 📌 Project Description
A high‑fidelity full‑stack **MERN** application powered by **AssemblyAI v3** API for instant real‑time live caption streaming over secure WebSockets, alongside recorded voice notes and file‑upload transcription capabilities. Secure user identity management is handled via **Clerk Auth**.

---

## ✨ Key Features
- **Realtime responsive captions** – subtitle‑like live transcription as you speak.
- **Audio file uploads** – supports `.mp3`, `.wav`, `.m4a` with automatic transcription.
- **Premium glassmorphic analytics** – dynamic cards tracking **Total Notes** and **Words Captured**.
- **Copy‑to‑clipboard** – one‑click copy of the active transcript.
- **Download transcript** – export the transcript as a `.txt` file.
- **Permanent deletion** – delete individual history items; changes are persisted in MongoDB.
- **Secure authentication** – Clerk protects all routes and provides OAuth/social login.

---

## 🛠️ Tech Stack
| Layer | Technologies |
|-------|--------------|
| **Frontend** | ReactJS, Tailwind CSS, Vite |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas (Mongoose) |
| **Cloud APIs** | AssemblyAI v3, Clerk Auth |

---

## 📅 Detailed 7‑Day Development Roadmap
| Day | Milestones |
|-----|------------|
| **Day 1** | Project kickoff, repository initialization, architecture planning, and Git setup. |
| **Day 2** | Advanced UI engineering – cinematic dark‑theme, glassmorphic layout wrappers, Tailwind component library. |
| **Day 3** | Backend Express server scaffolding, middleware configuration, CORS integration, and wrapping routes with Clerk authentication. |
| **Day 4** | Core AssemblyAI integration – async file‑upload endpoint, transcription handling, and robust error processing. |
| **Day 5‑6** | Real‑time architecture – token endpoint, secure WebSocket handshake, live‑stream handling, and Mongoose schemas for historical persistence. |
| **Day 7** | SaaS‑level polish – reorder UI to place Live Caption above upload modules, inject dynamic analytics (Total Notes & Words Captured), add Copy/Download/Delete features, final testing and deployment readiness. |

---

## 💻 Local Setup Instructions
1. **Clone the repository**
   ```bash
   git clone https://github.com/Sarthak170306/Speech-to-Text.git
   cd Speech-to-Text
   ```
2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```
3. **Create a `.env` file in the `backend` folder** (copy from `.env.example` if present) and add the required variables:
   ```dotenv
   PORT=5000                # or any free port
   MONGO_URI=mongodb+srv://<user>:<pwd>@cluster0.mongodb.net/speech2text
   ASSEMBLYAI_API_KEY=your_assemblyai_key
   CLERK_SECRET_KEY=your_clerk_secret
   CLIENT_ORIGIN=http://localhost:5173   # frontend dev URL
   ```
4. **Start the backend server**
   ```bash
   npm run dev
   ```
5. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```
6. **Run the frontend development server**
   ```bash
   npm run dev
   ```
7. Open your browser at `http://localhost:5173`, sign in via Clerk, and start transcribing!

---

*Enjoy a premium, glass‑morphic transcription experience powered by AssemblyAI and protected by Clerk.*
