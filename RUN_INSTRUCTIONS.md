# How to Run Tourly Application

## Prerequisites
- Node.js installed (v14 or higher)
- npm installed

## Step-by-Step Instructions

### 1. Start the Backend Server

Open a terminal/command prompt and navigate to the backend directory:

```bash
cd backend
npm start
```

The backend server will start on **http://localhost:5000**

You should see:
```
Connected to SQLite database
Default admin user created: admin@tourly.com / admin123
Server is running on port 5000
```

**Keep this terminal open!**

### 2. Start the Frontend Development Server

Open a **NEW** terminal/command prompt and navigate to the frontend directory:

```bash
cd frontend
npm run dev
```

The frontend will start on **http://localhost:5173**

You should see:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3. Access the Application

Open your web browser and go to:
**http://localhost:5173**

## Default Admin Account

- **Email:** admin@tourly.com
- **Password:** admin123

## Quick Test Flow

1. **Browse Trips:** Go to "Packages" page to see available trips
2. **Register:** Click "Login/Signup" → "Create One" to register a new account
3. **Login:** Use your credentials or the admin account
4. **Book a Trip:** Click "Book Now" on any trip
5. **View Dashboard:** See your bookings in "Dashboard"
6. **Request Manager:** Click "Request to be Manager" in dashboard
7. **Admin:** Login as admin to approve manager requests
8. **Manager:** Create trips after being approved

## Troubleshooting

### Backend won't start
- Make sure port 5000 is not in use
- Check if all dependencies are installed: `cd backend && npm install`

### Frontend won't start
- Make sure port 5173 is not in use
- Check if all dependencies are installed: `cd frontend && npm install`

### Database errors
- The database will be created automatically on first run
- If issues occur, delete `backend/database.sqlite` and restart

### CORS errors
- Make sure backend is running on port 5000
- Check that frontend is trying to connect to `http://localhost:5000`

## Stopping the Servers

- Press `Ctrl + C` in each terminal to stop the servers




