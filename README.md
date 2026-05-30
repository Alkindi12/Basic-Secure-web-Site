#  Intertainment Booking Website

A full-stack Intertainment  booking website where users can browse and book entertainment trips. Built with {Node.js/Express backend}, React frontend, and {SQLite database}.

the project named as Trouly = Trusted Reservation Of Unique Local activitY

Some images of the projects 

Admin dash can give the user permission to upload his trips to users<img width="1544" height="670" alt="Screenshot 2026-05-30 232936" src="https://github.com/user-attachments/assets/cd24105d-1a39-4418-95f0-2ba9dc5b5f0f" />
User Can mangae his Trips <img width="1438" height="880" alt="Screenshot 2026-05-30 233242" src="https://github.com/user-attachments/assets/14c5697c-c536-45e8-bc04-5112e526ffe7" />


<img width="1293" height="719" alt="manager Dash" src="https://github.com/user-attachments/assets/b9f97204-c532-42fc-9ee4-bec177c6aea9" />


## Features

### User Features
- User registration and login (session-based authentication)
- Browse all available trips/packages
- Search and filter trips by location, price, and date
- Book trips with name, number of people, and date selection
- View personal bookings dashboard
- Cancel bookings
- Request to become a manager

### Manager Features
- Create new trips with image upload
- Edit and delete trips
- View bookings for their trips
- Manage trip availability

### Admin Features
- View all users
- Approve/reject manager requests
- Full system access

## Tech Stack

### Backend
- Node.js
- Express.js
- SQLite3
- Express-session (session-based authentication)
- Bcrypt (password hashing)
- Multer (file uploads)
- CORS

### Frontend
- React
- React Router DOM
- Axios
- Vite

## Project Structure

```
course_project/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── tripController.js
│   │   ├── bookingController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── trips.js
│   │   ├── bookings.js
│   │   └── admin.js
│   ├── uploads/
│   │   └── trips/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── README.md
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, defaults are set):
```
PORT=5000
SESSION_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

4. Start the server:
```bash
npm start
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Default Admin Account

A default admin account is automatically created:
- **Email:** admin@tourly.com
- **Password:** admin123

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/bookings` - Get user's bookings
- `POST /api/users/request-manager` - Request manager role
- `GET /api/users/profile` - Get user profile

### Trips
- `GET /api/trips` - Get all trips (with search/filter params)
- `GET /api/trips/:id` - Get single trip
- `POST /api/trips` - Create trip (manager/admin only)
- `PUT /api/trips/:id` - Update trip (manager/admin only)
- `DELETE /api/trips/:id` - Delete trip (manager/admin only)
- `GET /api/trips/my-trips` - Get manager's trips

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/my-bookings` - Get user's bookings
- `DELETE /api/bookings/:id` - Cancel booking
- `GET /api/bookings/trip/:tripId` - Get bookings for trip (manager only)

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/manager-requests` - Get pending manager requests
- `POST /api/admin/manager-requests/:userId/approve` - Approve manager request
- `POST /api/admin/manager-requests/:userId/reject` - Reject manager request

## Database Schema

### Users Table
- id (PRIMARY KEY)
- email (UNIQUE)
- password (hashed)
- name
- role (user/manager/admin)
- manager_request_status (null/pending/approved/rejected)
- created_at

### Trips Table
- id (PRIMARY KEY)
- name
- image_path
- date_available (DATE)
- location
- entry_fee (DECIMAL)
- max_people (INTEGER)
- current_available (INTEGER)
- manager_id (FOREIGN KEY)
- created_at

### Bookings Table
- id (PRIMARY KEY)
- user_id (FOREIGN KEY)
- trip_id (FOREIGN KEY)
- booking_name
- number_of_people (INTEGER)
- booking_date (DATE)
- created_at

## Features Implementation

### Booking System
- When a booking is created, available spots decrease
- When a booking is cancelled, available spots are restored
- Booking date must match trip's available date
- Number of people cannot exceed available spots

### Manager Request Flow
1. User requests to become manager
2. Admin sees pending request in admin dashboard
3. Admin can approve or reject
4. If approved, user role changes to manager

### Image Upload
- Images are stored locally in `backend/uploads/trips/`
- Supported formats: jpeg, jpg, png, gif, webp
- Maximum file size: 5MB

## Development Notes

- Session cookies are used for authentication
- CORS is configured for frontend-backend communication
- Images are served statically from `/uploads/trips/`
- Database is automatically initialized on first run
- Default admin user is created automatically

## License

ISC




