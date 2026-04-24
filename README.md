# AI Studio - Video Publishing Platform

A modern, AI-powered video publishing platform built with Next.js, React, and MongoDB. Upload videos, get intelligent title and description suggestions powered by multiple AI providers, and share your content seamlessly.

## Live Demo

- Production: https://ai-studio-video-publishing-platform.vercel.app/
- Repository: https://github.com/huzaifa157/AI-Studio---Video-Publishing-Platform

## ✨ Features

- **Video Discovery**: Browse and discover videos with a YouTube-style layout
- **AI-Powered Suggestions**: Automatic title and description generation using multiple AI providers (OpenAI, Groq, Gemini, OpenRouter)
- **Video Management**: Create, publish, and delete videos with ease
- **Public Video Watching**: Stream videos without authentication required
- **User Authentication**: Secure login and registration with NextAuth
- **ImageKit Integration**: Optimized video upload and storage with ImageKit CDN
- **Rate Limiting**: Built-in rate limiting on AI endpoints for abuse prevention
- **Responsive Design**: Modern, mobile-friendly UI with Tailwind CSS
- **Dark Theme**: Professional dark interface with gradient backgrounds

## 🛠️ Tech Stack

- **Frontend**: React 19.2.4, Next.js 16.2.4 (App Router with Turbopack)
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **Authentication**: NextAuth with Credentials strategy
- **Styling**: Tailwind CSS 4
- **Media**: ImageKit for video uploads and CDN
- **AI Providers**: 
  - OpenAI (GPT models)
  - Groq (open-source models)
  - Google Gemini
  - OpenRouter (multi-model support)
- **Build Tool**: Turbopack

## 📋 Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **npm**: v9+
- **MongoDB**: Local or cloud instance (MongoDB Atlas)
- **ImageKit Account**: For video upload functionality
- **API Keys** (at least one):
  - Groq API key (recommended, free tier available)
  - OpenAI API key (optional)
  - Google Gemini API key (optional)
  - OpenRouter API key (optional)

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd imagekit
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/imagekit

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# ImageKit
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=your-imagekit-public-key
IMAGEKIT_PRIVATE_KEY=your-imagekit-private-key
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-account-id

# AI Providers (add at least one)
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
OPENROUTER_API_KEY=your-openrouter-api-key
```

### 4. Start MongoDB

```bash
mongod
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
imagekit/
├── app/
│   ├── api/                      # API Routes
│   │   ├── ai/suggest/route.ts   # AI suggestion endpoint
│   │   ├── auth/                 # Authentication routes
│   │   ├── imagekit-auth/        # ImageKit auth endpoint
│   │   └── video/                # Video CRUD endpoints
│   ├── components/               # React components
│   │   ├── FileUpload.tsx        # ImageKit uploader
│   │   └── Providers.tsx         # NextAuth provider
│   ├── login/                    # Login page
│   ├── register/                 # Registration page
│   ├── watch/[id]/               # Video watch page
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── models/                       # MongoDB models
│   ├── User.ts
│   └── Video.ts
├── utils/
│   ├── auth.ts                   # Authentication helpers
│   └── db.ts                     # Database connection
├── proxy.ts                      # NextAuth middleware
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

## 🎯 API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/callback/credentials` - Login with credentials
- `POST /api/auth/signout` - Logout
- `GET /api/auth/session` - Get current session
- `GET /api/auth/csrf` - Get CSRF token

### Videos

- `GET /api/video` - List all videos (public)
- `POST /api/video` - Create video (requires auth)
- `DELETE /api/video/[id]` - Delete video (requires auth, owner only)

### AI Suggestions

- `POST /api/ai/suggest` - Generate AI suggestions for title/description

**Request body:**
```json
{
  "mode": "draft" | "improve",
  "brief": "topic or idea (max 300 chars)",
  "title": "existing title (max 120 chars)",
  "description": "existing description (max 3000 chars)"
}
```

**Response:**
```json
{
  "title": "Generated title",
  "description": "Generated description",
  "source": "groq|openai|gemini|openrouter"
}
```

### Upload

- `GET /api/imagekit-auth` - Get ImageKit authentication token

## 🤖 AI Provider Configuration

The app uses a provider priority chain:
1. **Groq** (default, free tier available)
2. **Google Gemini** 
3. **OpenRouter**
4. **OpenAI**
5. **Fallback generator** (if all providers fail)

**Rate Limiting**: 15 requests per user per 60 seconds
**Timeout**: 12 seconds per request with automatic retry

## 🗄️ Database Schema

### User Model
```typescript
{
  email: string (unique)
  password: string (hashed)
  createdAt: Date
}
```

### Video Model
```typescript
{
  title: string (max 120 chars)
  description: string (max 3000 chars)
  videoUrl: string
  thumbnailUrl: string
  createdBy: string (user email or id)
  createdAt: Date
}
```

## 🔐 Security Features

- **NextAuth Middleware**: Request authorization and rate limiting
- **Input Validation**: Server-side validation on all endpoints
- **Rate Limiting**: Per-user rate limiting on AI endpoints (15 req/min)
- **Timeout Protection**: 12-second timeout on external API calls
- **Secure Password Storage**: Bcrypt hashing for passwords
- **CSRF Protection**: NextAuth CSRF tokens on auth endpoints

## 🎨 UI/UX

- **Dark Theme**: Modern dark interface optimized for viewing
- **Responsive Grid**: 3 columns on desktop, 2 on tablet, 1 on mobile
- **Video Cards**: Hover effects, metadata display, action buttons
- **AI Assistant Section**: Integrated into upload form
- **Watch Page**: Full-featured video player with metadata
- **Public Viewing**: Anyone can watch videos without login

## 📦 Build for Production

```bash
npm run build
npm start
```

## 🧪 Testing

Test the complete flow:

```powershell
# Register and login
$email = "test_$(Get-Random)@local.dev"
$password = "Test@123456"

# Create a video and test AI suggestions
# (See API endpoints section for curl/PowerShell examples)
```

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `NEXTAUTH_URL` | Yes | NextAuth base URL |
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth encryption |
| `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` | Yes | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | Yes | ImageKit private key |
| `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | Yes | ImageKit URL endpoint |
| `GROQ_API_KEY` | No | Groq API key (recommended) |
| `OPENAI_API_KEY` | No | OpenAI API key |
| `GEMINI_API_KEY` | No | Google Gemini API key |
| `OPENROUTER_API_KEY` | No | OpenRouter API key |

## 🚨 Important Notes

- **API Keys**: Store all API keys securely in `.env` file
- **NEXTAUTH_SECRET**: Generate a strong random string for production
- **MongoDB**: Ensure MongoDB is running before starting the app
- **ImageKit**: Configure your ImageKit account with proper upload limits
- **Rate Limits**: Adjust rate limiting in `/api/ai/suggest/route.ts` as needed

## 🐛 Troubleshooting

### Port already in use
```bash
taskkill /PID <process-id> /F
# or use a different port
npm run dev -- -p 3001
```

### MongoDB connection error
```bash
# Ensure MongoDB is running
mongod
```

### Image/Video upload fails
- Check ImageKit credentials
- Verify ImageKit project configuration
- Check file size limits

## 🤝 Contributing

Contributions are welcome! Please ensure your code follows the project's style and includes proper error handling.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For issues or questions, please create an issue in the repository.

---

**Built with ❤️ using Next.js and TypeScript**
