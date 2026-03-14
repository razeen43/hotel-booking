document.addEventListener('DOMContentLoaded', async () => {

    /* --- GLOBALS & STATE --- */
    let currentUser = JSON.parse(localStorage.getItem('hotel_current_user')) || null;
    let reservations = []; // Now fetched from backend!

    // Wait until reservations load from MongoDB before initializing calendar constraints
    async function loadReservations() {
        try {
            const res = await fetch('/api/reservations');
            if(res.ok) {
                reservations = await res.json();
            }
        } catch (e) {
            console.error("Failed to load reservations from MongoDB. Server might be down.", e);
        }
    }
    await loadReservations();

    // UI Elements
    const authLink = document.getElementById('authLink');
    const reservationsLink = document.getElementById('reservationsLink');
    const logoutLink = document.getElementById('logoutLink');
    
    // Auth Modal Elements
    const authModal = document.getElementById('authModal');
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authSwitchLink = document.getElementById('authSwitchLink');
    const nameGroup = document.getElementById('nameGroup');
    const authName = document.getElementById('authName');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    
    let isLoginMode = true;

    // Calendar & Booking Elements
    const bookingModal = document.getElementById('bookingModal');
    const suiteSelect = document.getElementById('suiteSelect');
    const calendarGrid = document.getElementById('calendarGrid');
    const monthYearText = document.getElementById('calendarMonthYear');
    const summaryCheckin = document.getElementById('summaryCheckin');
    const summaryCheckout = document.getElementById('summaryCheckout');
    const bookingSummary = document.getElementById('bookingSummary');

    // Reservations Modal Element
    const reservationsModal = document.getElementById('reservationsModal');
    const reservationsList = document.getElementById('reservationsList');

    let currentDate = new Date();
    let selectedStartDate = null;
    let selectedEndDate = null;

    /* --- INITIALIZATION --- */
    updateAuthUI();

    // 1. Navigation Scroll
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    });

    // 2. Mobile Nav
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (mobileBtn && navLinks) {
        mobileBtn.addEventListener('click', () => navLinks.classList.toggle('active'));
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => navLinks.classList.remove('active'));
        });
    }

    // 3. Scroll Reveal
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right').forEach(el => observer.observe(el));



    /* --- REST API AUTHENTICATION (MongoDB) --- */
    function updateAuthUI() {
        if (currentUser) {
            authLink.style.display = 'none';
            reservationsLink.style.display = 'inline-block';
            logoutLink.style.display = 'inline-block';
            
            // If Admin role, add admin dashboard link
            if (currentUser.isAdmin && !document.getElementById('adminLinkBtn')) {
                const a = document.createElement('a');
                a.href = "/admin";
                a.id = "adminLinkBtn";
                a.textContent = "Admin Panel";
                a.style.color = "var(--color-gold)";
                authLink.parentNode.insertBefore(a, logoutLink);
            }
        } else {
            authLink.style.display = 'inline-block';
            reservationsLink.style.display = 'none';
            logoutLink.style.display = 'none';
            const adminLnk = document.getElementById('adminLinkBtn');
            if (adminLnk) adminLnk.remove();
        }
    }

    window.openAuthModal = () => {
        isLoginMode = true;
        setAuthModeUI();
        authModal.classList.add('active');
    };
    
    window.closeAuthModal = () => {
        authModal.classList.remove('active');
        authForm.reset();
    };

    window.toggleAuthMode = () => {
        isLoginMode = !isLoginMode;
        setAuthModeUI();
    };

    function setAuthModeUI() {
        if (isLoginMode) {
            authTitle.textContent = "Sign In";
            authSubtitle.textContent = "Welcome back to Hotel Paris.";
            nameGroup.style.display = "none";
            authName.removeAttribute('required');
            authSubmitBtn.textContent = "Sign In";
            authSwitchLink.textContent = "Don't have an account? Register here.";
        } else {
            authTitle.textContent = "Register";
            authSubtitle.textContent = "Create an account to book your stay.";
            nameGroup.style.display = "block";
            authName.setAttribute('required', 'true');
            authSubmitBtn.textContent = "Create Account";
            authSwitchLink.textContent = "Already have an account? Sign In.";
        }
    }

    window.handleAuthSubmit = async (e) => {
        e.preventDefault();
        const email = authEmail.value.trim();
        const password = authPassword.value;
        const name = authName.value.trim();

        const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
        const payload = isLoginMode ? { email, password } : { name, email, password };

        try {
            authSubmitBtn.textContent = "Processing...";
            authSubmitBtn.disabled = true;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            
            if (!res.ok) {
                alert(data.message || "Authentication failed");
                return;
            }

            currentUser = data; // Returns the MongoDB user document
            localStorage.setItem('hotel_current_user', JSON.stringify(currentUser));
            updateAuthUI();
            closeAuthModal();
            alert(isLoginMode ? `Welcome back, ${currentUser.name}!` : "Registration successful! Welcome to Hotel Paris.");
        } catch(err) {
            console.error(err);
            alert("Database connection error. Ensure MongoDB backend is running!");
        } finally {
            authSubmitBtn.textContent = isLoginMode ? "Sign In" : "Create Account";
            authSubmitBtn.disabled = false;
        }
    };

    window.logout = () => {
        currentUser = null;
        localStorage.removeItem('hotel_current_user');
        updateAuthUI();
        alert("You have been successfully logged out.");
    };


    /* --- MongoDB RESERVATIONS VIEWER --- */
    window.openReservationsModal = async () => {
        if (!currentUser) return;
        reservationsList.innerHTML = '<p>Fetching securely from database...</p>';
        reservationsModal.classList.add('active');
        
        try {
            const res = await fetch(`/api/reservations/user/${currentUser._id}`);
            const myRes = await res.json();
            
            reservationsList.innerHTML = '';
            
            if (myRes.length === 0) {
                reservationsList.innerHTML = '<p>You have no current reservations.</p>';
            } else {
                myRes.sort((a,b) => new Date(a.startDate) - new Date(b.startDate)).forEach(r => {
                    const sDate = new Date(r.startDate).toLocaleDateString();
                    const eDate = new Date(r.endDate).toLocaleDateString();
                    const html = `
                        <div class="reservation-card">
                            <h3>${r.suiteName}</h3>
                            <p><strong>Check-in:</strong> ${sDate}</p>
                            <p><strong>Check-out:</strong> ${eDate}</p>
                            <p><strong>Status:</strong> ${r.status || 'Confirmed'}</p>
                            <p><small style="color:#aaa;">DB ID: ${r._id}</small></p>
                        </div>
                    `;
                    reservationsList.insertAdjacentHTML('beforeend', html);
                });
            }
        } catch(err) {
            console.error(err);
            reservationsList.innerHTML = '<p style="color:red;">Error loading DB records.</p>';
        }
    };

    window.closeReservationsModal = () => {
        reservationsModal.classList.remove('active');
    };



    /* --- INTERACTIVE CALENDAR & BOOKING --- */
    window.openBookingModal = async (suite = "Any Suite") => {
        // Refresh master reservations from DB just to be safe before rendering calendar
        await loadReservations();
        
        suiteSelect.value = suite;
        selectedStartDate = null;
        selectedEndDate = null;
        bookingSummary.style.display = 'none';
        currentDate = new Date();
        renderCalendar();
        bookingModal.classList.add('active');
    };

    window.closeBookingModal = () => {
        bookingModal.classList.remove('active');
    };

    window.handleSuiteChange = (suiteName) => {
        selectedStartDate = null;
        selectedEndDate = null;
        bookingSummary.style.display = 'none';
        renderCalendar();
    };

    function isDateBooked(dateObj) {
        const suite = suiteSelect.value;
        if (suite === "Any Suite") return false;

        for (let r of reservations) {
            if (r.suiteName !== suite) continue;
            const rStart = new Date(r.startDate).setHours(0,0,0,0);
            const rEnd = new Date(r.endDate).setHours(0,0,0,0);
            const checkTime = dateObj.getTime();
            if (checkTime >= rStart && checkTime <= rEnd) return true;
        }
        return false;
    }

    function isRangeValid(start, end) {
        let current = new Date(start);
        while (current <= end) {
            if (isDateBooked(current)) return false;
            current.setDate(current.getDate() + 1);
        }
        return true;
    }

    function renderCalendar() {
        calendarGrid.innerHTML = '';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        monthYearText.textContent = `${monthNames[month]} ${year}`;
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0,0,0,0);

        for (let i = 0; i < firstDay; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('calendar-day', 'empty');
            calendarGrid.appendChild(emptyDiv);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            dateObj.setHours(0,0,0,0);
            
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('calendar-day');
            dayDiv.textContent = day;

            let booked = isDateBooked(dateObj);

            if (dateObj < today) {
                dayDiv.classList.add('disabled');
            } else if (booked) {
                dayDiv.classList.add('booked');
            } else {
                dayDiv.addEventListener('click', () => handleDayClick(dateObj));
            }

            if (selectedStartDate && dateObj.getTime() === selectedStartDate.getTime()) dayDiv.classList.add('selected');
            if (selectedEndDate && dateObj.getTime() === selectedEndDate.getTime()) dayDiv.classList.add('selected');
            if (selectedStartDate && selectedEndDate && dateObj > selectedStartDate && dateObj < selectedEndDate) dayDiv.classList.add('in-range');

            calendarGrid.appendChild(dayDiv);
        }
    }

    function handleDayClick(date) {
        if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
            selectedStartDate = date;
            selectedEndDate = null;
            bookingSummary.style.display = 'none';
        } else if (date < selectedStartDate) {
            selectedStartDate = date;
        } else if (date.getTime() === selectedStartDate.getTime()) {
            selectedStartDate = null;
        } else {
            if(isRangeValid(selectedStartDate, date)) {
                selectedEndDate = date;
                updateSummary();
            } else {
                alert("Your selection includes dates that are already reserved for this suite. Please pick different dates.");
                selectedStartDate = date; 
                selectedEndDate = null;
                bookingSummary.style.display = 'none';
            }
        }
        renderCalendar();
    }

    function updateSummary() {
        if (selectedStartDate && selectedEndDate) {
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            summaryCheckin.textContent = selectedStartDate.toLocaleDateString('en-US', options);
            summaryCheckout.textContent = selectedEndDate.toLocaleDateString('en-US', options);
            bookingSummary.style.display = 'block';
        }
    }

    window.prevMonth = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
    window.nextMonth = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };

    window.confirmReservation = async () => {
        if (!currentUser) {
            alert("You must be signed in to make a reservation.");
            openAuthModal();
            return;
        }
        
        let suite = suiteSelect.value;
        if (suite === "Any Suite") {
            const suites = ["Classic Room", "Executive Suite", "The Penthouse"];
            suite = suites[Math.floor(Math.random() * suites.length)];
            alert(`Since you selected 'Any Suite', we have automatically assigned you to: ${suite}`);
        }

        const payload = {
            userId: currentUser._id,
            suiteName: suite,
            startDate: selectedStartDate.toISOString(),
            endDate: selectedEndDate.toISOString()
        };

        try {
            document.querySelector('#bookingSummary .btn-primary').textContent = "Processing...";
            const res = await fetch('/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if(!res.ok) {
                const data = await res.json();
                alert("Booking Error: " + data.message);
                return;
            }

            alert(`DB Success! Your reservation for ${suite} is confirmed and saved to MongoDB!`);
            closeBookingModal();
            
            // Reload global reservations array from MongoDB immediately so validation updates
            await loadReservations();

        } catch (err) {
            console.error(err);
            alert("Database connection error while booking.");
        } finally {
            document.querySelector('#bookingSummary .btn-primary').textContent = "Confirm Reservation";
        }
    };

});
