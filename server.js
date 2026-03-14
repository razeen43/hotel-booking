const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve standard static files in this folder

// MongoDB Connection
// IMPORTANT: Replace <db_password> with your actual MongoDB database password
const mongoURI = 'mongodb+srv://admin:raz@cluster0.5kriclg.mongodb.net/hotel_paris?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI).then(() => {
    console.log("Successfully connected to MongoDB Atlas database 'hotel_paris'.");
}).catch(err => {
    console.error("MongoDB connection error. Please ensure you replaced <db_password> with your actual password and whitelisted your IP address in Atlas:", err);
});

// Database Schemas & Models
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Not hashing this per the specific request for "admin to view password"
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const reservationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    suiteName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, default: 'Confirmed' }
});

const User = mongoose.model('User', userSchema);
const Reservation = mongoose.model('Reservation', reservationSchema);

// Auth Routes

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        let existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists." });
        }

        const newUser = new User({ name, email, password });
        await newUser.save();

        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ message: "Server error during registration.", error });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });

        if (!user) {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Server error during login." });
    }
});

// Reservations Routes

// Get all reservations
app.get('/api/reservations', async (req, res) => {
    try {
        const reservations = await Reservation.find();
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ message: "Server error fetching reservations." });
    }
});

// Create reservation
app.post('/api/reservations', async (req, res) => {
    try {
        const { userId, suiteName, startDate, endDate } = req.body;

        // Perform basic overlap validation server-side just in case
        const parsedStart = new Date(startDate).setHours(0, 0, 0, 0);
        const parsedEnd = new Date(endDate).setHours(0, 0, 0, 0);

        const overlapping = await Reservation.findOne({
            suiteName: suiteName,
            $and: [
                { startDate: { $lte: endDate } },
                { endDate: { $gte: startDate } }
            ]
        });

        if (overlapping) {
            return res.status(400).json({ message: "Booking interval overlaps with existing reservation." });
        }

        const newReservation = new Reservation({ userId, suiteName, startDate, endDate });
        await newReservation.save();

        res.status(201).json(newReservation);
    } catch (error) {
        res.status(500).json({ message: "Server error creating reservation.", error });
    }
});

// Get user specific reservations
app.get('/api/reservations/user/:userId', async (req, res) => {
    try {
        const userReservations = await Reservation.find({ userId: req.params.userId });
        res.json(userReservations);
    } catch (error) {
        res.status(500).json({ message: "Server error fetching user reservations." });
    }
});

// Admin Routes

// Get all users (and raw passwords, intentionally per requirements)
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find().select('-__v').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching user lists." });
    }
});

// Admin Endpoint Setup: If no admin exists, create a default one
async function seedAdmin() {
    const adminExists = await User.findOne({ email: 'admin@hotelparis.com' });
    if (!adminExists) {
        await User.create({
            name: "Super Admin",
            email: "admin@hotelparis.com",
            password: "adminpassword123", /* Exposed intentionally */
            isAdmin: true
        });
        console.log("Seeded default admin user: admin@hotelparis.com / adminpassword123");
    }
}
setTimeout(seedAdmin, 2000);

// Basic routing for frontend root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Routing for admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
