import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { 
    getFirestore, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// Firebase config
const config = {
    apiKey: "AIzaSyBkkq4nPnmyfSOKtVLsO95rpAUsMDA1o0A",
    authDomain: "workplace-scheduler-ace38.firebaseapp.com",
    projectId: "workplace-scheduler-ace38",
    storageBucket: "workplace-scheduler-ace38.firebasestorage.app",
    messagingSenderId: "153631302747",
    appId: "1:153631302747:web:2c731351893dca19510b7e"
};

const app = initializeApp(config);
const db = getFirestore(app);

// Global state
let selectedWorkplace = null;
let workers = [];
let hours = {};
let currentSchedule = null;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Utility functions
const timeToHour = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + (m / 60);
};

const hourToTime = (hour) => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const formatTime = (timeStr) => {
    if (!timeStr) return '';
    let [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${period}`;
};

// Load workplaces
async function loadWorkplaces() {
    try {
        const snapshot = await getDocs(collection(db, 'workplaces'));
        let html = '';
        
        if (snapshot.empty) {
            const defaults = [
                { id: 'esports_lounge', name: '🎮 eSports Lounge' },
                { id: 'esports_arena', name: '🏟️ eSports Arena' },
                { id: 'it_service_center', name: '💻 IT Service Center' }
            ];
            
            for (const wp of defaults) {
                await initWorkplace(wp.id);
                html += `<div class="workplace-card" onclick="selectWorkplace('${wp.id}')">
                    <h4>${wp.name}</h4>
                    <p>${wp.id}</p>
                </div>`;
            }
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                const name = data.name || doc.id.replace('_', ' ').toUpperCase();
                html += `<div class="workplace-card" onclick="selectWorkplace('${doc.id}')">
                    <h4>${name}</h4>
                    <p>${doc.id}</p>
                </div>`;
            });
        }
        
        document.getElementById('workplaceGrid').innerHTML = html;
    } catch (error) {
        console.error('Error loading workplaces:', error);
    }
}

// Initialize workplace
async function initWorkplace(id) {
    try {
        const docRef = doc(db, 'workplaces', id);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            await addDoc(collection(db, 'workplaces'), {
                name: id.replace('_', ' ').toUpperCase(),
                created_at: new Date().toISOString(),
                hours_of_operation: {}
            });
        }
    } catch (error) {
        console.error('Error initializing workplace:', error);
    }
}

// Select workplace
window.selectWorkplace = async function(id) {
    selectedWorkplace = id;
    
    // Update UI
    document.querySelectorAll('.workplace-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.workplace-card').classList.add('selected');
    
    document.getElementById('scheduleContent').style.display = 'block';
    
    // Load data
    await Promise.all([loadWorkers(), loadHours()]);
    hideAllForms();
    document.getElementById('scheduleDisplay').innerHTML = '<div class="loading">Select an option above to get started.</div>';
};

// Load workers
async function loadWorkers() {
    try {
        const snapshot = await getDocs(collection(db, 'workplaces', selectedWorkplace, 'workers'));
        workers = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const availability = parseAvailability(data['Days & Times Available'] || '');
            
            workers.push({
                id: doc.id,
                firstName: data['First Name'] || 'Unknown',
                lastName: data['Last Name'] || 'Worker',
                email: data['Email'] || 'no-email',
                workStudy: data['Work Study'] === 'Yes',
                availability,
                totalHours: calculateTotalHours(availability)
            });
        });
        
        console.log(`Loaded ${workers.length} workers`);
    } catch (error) {
        console.error('Error loading workers:', error);
    }
}

// Load hours
async function loadHours() {
    try {
        const docRef = doc(db, 'workplaces', selectedWorkplace);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            hours = docSnap.data().hours_of_operation || {};
        } else {
            hours = {};
        }
        
        console.log('Loaded hours:', hours);
    } catch (error) {
        console.error('Error loading hours:', error);
    }
}

// Parse availability text
function parseAvailability(text) {
    const availability = {};
    if (!text) return availability;
    
    text.split(',').forEach(block => {
        const match = block.trim().match(/(\w+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/i);
        if (match) {
            const [, day, start, end] = match;
            const dayName = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
            
            if (!availability[dayName]) availability[dayName] = [];
            availability[dayName].push({
                start,
                end,
                startHour: timeToHour(start),
                endHour: timeToHour(end)
            });
        }
    });
    
    return availability;
}

// Calculate total availability hours
function calculateTotalHours(availability) {
    let total = 0;
    Object.values(availability).forEach(slots => {
        slots.forEach(slot => {
            total += slot.endHour - slot.startHour;
        });
    });
    return total;
}

// Show forms
window.showGenerateForm = function() {
    hideAllForms();
    document.getElementById('generateForm').style.display = 'block';
};

window.checkAvailability = function() {
    hideAllForms();
    document.getElementById('availabilityForm').style.display = 'block';
};

window.hideAllForms = function() {
    document.querySelectorAll('.schedule-form').forEach(form => {
        form.style.display = 'none';
    });
};

// Generate schedule
window.generateSchedule = async function() {
    if (workers.length === 0 || Object.keys(hours).length === 0) {
        alert('Need workers and operating hours to generate schedule.');
        return;
    }
    
    const maxHours = parseInt(document.getElementById('maxHours').value);
    const workersPerShift = parseInt(document.getElementById('workersPerShift').value);
    
    document.getElementById('scheduleDisplay').innerHTML = '<div class="loading">🔄 Generating schedule...</div>';
    
    try {
        const schedule = createOptimizedSchedule(maxHours, workersPerShift);
        const scheduleId = await saveSchedule(schedule);
        displaySchedule(schedule, false, scheduleId);
        hideAllForms();
    } catch (error) {
        console.error('Error generating schedule:', error);
        document.getElementById('scheduleDisplay').innerHTML = '<div class="warning">Error generating schedule: ' + error.message + '</div>';
    }
};

// Create optimized schedule
function createOptimizedSchedule(maxHours, workersPerShift) {
    const schedule = {};
    const workerHours = {};
    
    // Initialize worker hours
    workers.forEach(w => workerHours[w.email] = 0);
    
    // Process work study students first (need exactly 5 hours)
    const workStudyWorkers = workers.filter(w => w.workStudy);
    workStudyWorkers.forEach(worker => {
        assignWorkStudyHours(worker, schedule, workerHours);
    });
    
    // Fill remaining slots with regular workers
    const regularWorkers = workers.filter(w => !w.workStudy);
    
    DAYS.forEach(day => {
        const dayHours = hours[day];
        if (!dayHours || dayHours.length === 0) return;
        
        if (!schedule[day]) schedule[day] = [];
        
        dayHours.forEach(period => {
            fillDaySlots(day, period, schedule, regularWorkers, workerHours, maxHours, workersPerShift);
        });
        
        // Sort shifts by start time
        schedule[day].sort((a, b) => timeToHour(a.start) - timeToHour(b.start));
    });
    
    return schedule;
}

// Assign work study hours (exactly 5)
function assignWorkStudyHours(worker, schedule, workerHours) {
    let assigned = 0;
    const target = 5;
    
    // Find best time slots for this worker
    const availableSlots = findAvailableSlots(worker);
    
    // Try to assign 5 hours optimally
    for (const slot of availableSlots) {
        if (assigned >= target) break;
        
        const duration = Math.min(slot.duration, target - assigned);
        if (duration >= 2) { // Minimum 2-hour shifts
            const shift = {
                start: hourToTime(slot.start),
                end: hourToTime(slot.start + duration),
                workers: [worker.firstName + ' ' + worker.lastName],
                emails: [worker.email],
                workStudy: true
            };
            
            if (!schedule[slot.day]) schedule[slot.day] = [];
            schedule[slot.day].push(shift);
            assigned += duration;
            workerHours[worker.email] += duration;
        }
    }
}

// Find available slots for a worker
function findAvailableSlots(worker) {
    const slots = [];
    
    Object.entries(worker.availability).forEach(([day, periods]) => {
        const dayHours = hours[day];
        if (!dayHours) return;
        
        dayHours.forEach(opHours => {
            periods.forEach(avail => {
                const start = Math.max(opHours.start_hour || timeToHour(opHours.start), avail.startHour);
                const end = Math.min(opHours.end_hour || timeToHour(opHours.end), avail.endHour);
                
                if (end > start) {
                    slots.push({
                        day,
                        start,
                        end,
                        duration: end - start
                    });
                }
            });
        });
    });
    
    return slots.sort((a, b) => b.duration - a.duration);
}

// Fill day slots with regular workers
function fillDaySlots(day, period, schedule, workers, workerHours, maxHours, workersPerShift) {
    const start = period.start_hour || timeToHour(period.start);
    const end = period.end_hour || timeToHour(period.end);
    
    // Find free time slots (not occupied by work study)
    const freeSlots = findFreeSlots(day, start, end, schedule[day] || []);
    
    freeSlots.forEach(slot => {
        fillTimeSlot(day, slot, schedule, workers, workerHours, maxHours, workersPerShift);
    });
}

// Find free time slots
function findFreeSlots(day, start, end, existingShifts) {
    const slots = [{ start, end }];
    
    existingShifts.forEach(shift => {
        const shiftStart = timeToHour(shift.start);
        const shiftEnd = timeToHour(shift.end);
        
        const newSlots = [];
        slots.forEach(slot => {
            if (slot.end <= shiftStart || slot.start >= shiftEnd) {
                newSlots.push(slot);
            } else {
                if (slot.start < shiftStart) {
                    newSlots.push({ start: slot.start, end: shiftStart });
                }
                if (slot.end > shiftEnd) {
                    newSlots.push({ start: shiftEnd, end: slot.end });
                }
            }
        });
        slots.splice(0, slots.length, ...newSlots);
    });
    
    return slots.filter(slot => slot.end - slot.start >= 2);
}

// Fill time slot with workers
function fillTimeSlot(day, slot, schedule, workers, workerHours, maxHours, workersPerShift) {
    let current = slot.start;
    
    while (current < slot.end) {
        const duration = Math.min(4, slot.end - current); // Max 4-hour shifts
        if (duration < 2) break;
        
        const shiftEnd = current + duration;
        
        // Find available workers
        const available = workers.filter(worker => {
            if (workerHours[worker.email] + duration > maxHours) return false;
            return isWorkerAvailable(worker, day, current, shiftEnd);
        });
        
        // Sort by current hours (fairness)
        available.sort((a, b) => workerHours[a.email] - workerHours[b.email]);
        
        const selected = available.slice(0, workersPerShift);
        
        const shift = {
            start: hourToTime(current),
            end: hourToTime(shiftEnd),
            workers: selected.length > 0 ? selected.map(w => `${w.firstName} ${w.lastName}`) : ['Unfilled'],
            emails: selected.map(w => w.email),
            workStudy: false
        };
        
        if (!schedule[day]) schedule[day] = [];
        schedule[day].push(shift);
        
        selected.forEach(worker => {
            workerHours[worker.email] += duration;
        });
        
        current = shiftEnd;
    }
}

// Check if worker is available
function isWorkerAvailable(worker, day, start, end) {
    const dayAvail = worker.availability[day] || [];
    return dayAvail.some(slot => slot.startHour <= start && end <= slot.endHour);
}

// Save schedule to Firebase
async function saveSchedule(schedule) {
    try {
        const scheduleData = {
            days: schedule,
            createdAt: new Date().toISOString(),
            workplaceId: selectedWorkplace,
            name: `Schedule ${new Date().toLocaleDateString()}`
        };
        
        const docRef = await addDoc(collection(db, 'workplaces', selectedWorkplace, 'schedules'), scheduleData);
        console.log('Schedule saved with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error saving schedule:', error);
        throw error;
    }
}

// View current schedule
window.viewCurrentSchedule = async function() {
    try {
        document.getElementById('scheduleDisplay').innerHTML = '<div class="loading">Loading current schedule...</div>';
        
        const snapshot = await getDocs(query(
            collection(db, 'workplaces', selectedWorkplace, 'schedules'),
            orderBy('createdAt', 'desc')
        ));
        
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const schedule = doc.data().days;
            displaySchedule(schedule, true);
        } else {
            document.getElementById('scheduleDisplay').innerHTML = '<div class="warning">No current schedule found. Generate a new one!</div>';
        }
    } catch (error) {
        console.error('Error loading current schedule:', error);
        document.getElementById('scheduleDisplay').innerHTML = '<div class="warning">Error loading schedule.</div>';
    }
};

// View schedule history
window.viewHistory = async function() {
    try {
        document.getElementById('scheduleDisplay').innerHTML = '<div class="loading">Loading schedule history...</div>';
        
        const snapshot = await getDocs(query(
            collection(db, 'workplaces', selectedWorkplace, 'schedules'),
            orderBy('createdAt', 'desc')
        ));
        
        let html = '<div class="schedule-display"><h3>📚 Schedule History</h3>';
        
        if (snapshot.empty) {
            html += '<p>No schedules found.</p>';
        } else {
            snapshot.forEach((doc, index) => {
                const data = doc.data();
                const date = new Date(data.createdAt).toLocaleDateString();
                html += `
                    <div style="padding: 1rem; border: 1px solid #dee2e6; margin-bottom: 0.5rem; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${data.name || 'Schedule'}</strong><br>
                            <small>Created: ${date}</small>
                            ${index === 0 ? '<span style="color: #28a745; font-weight: bold;"> (Current)</span>' : ''}
                        </div>
                        <div>
                            <button class="btn btn-secondary" onclick="viewScheduleById('${doc.id}')">View</button>
                            ${index !== 0 ? `<button class="btn btn-success" onclick="publishSchedule('${doc.id}')">Make Current</button>` : ''}
                            <button class="btn btn-danger" onclick="deleteSchedule('${doc.id}')">Delete</button>
                        </div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        document.getElementById('scheduleDisplay').innerHTML = html;
    } catch (error) {
        console.error('Error loading history:', error);
    }
};

// Find available workers
window.findAvailable = function() {
    const day = document.getElementById('availDay').value;
    const start = document.getElementById('availStart').value;
    const end = document.getElementById('availEnd').value;
    
    if (!start || !end) {
        alert('Please enter both start and end times.');
        return;
    }
    
    const startHour = timeToHour(start);
    const endHour = timeToHour(end);
    
    if (endHour <= startHour) {
        alert('End time must be after start time.');
        return;
    }
    
    const available = workers.filter(worker => {
        return isWorkerAvailable(worker, day, startHour, endHour);
    });
    
    const workStudy = available.filter(w => w.workStudy);
    const regular = available.filter(w => !w.workStudy);
    
    let html = `
        <div class="schedule-display">
            <h3>🚨 Available Workers</h3>
            <p><strong>${day} ${formatTime(start)} - ${formatTime(end)}</strong></p>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${available.length}</div>
                    <div class="stat-label">Total Available</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${workStudy.length}</div>
                    <div class="stat-label">Work Study</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${regular.length}</div>
                    <div class="stat-label">Regular Workers</div>
                </div>
            </div>
    `;
    
    if (available.length === 0) {
        html += '<div class="warning">❌ No workers available during this time.</div>';
    } else {
        if (workStudy.length > 0) {
            html += '<h4>🎓 Work Study Students</h4>';
            workStudy.forEach(worker => {
                html += `
                    <div style="padding: 0.75rem; border: 1px solid #28a745; margin-bottom: 0.5rem; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${worker.firstName} ${worker.lastName}</strong><br>
                            <small>${worker.email}</small>
                        </div>
                        <button class="btn btn-success" onclick="contactWorker('${worker.email}')">📧 Contact</button>
                    </div>
                `;
            });
        }
        
        if (regular.length > 0) {
            html += '<h4>👥 Regular Workers</h4>';
            regular.forEach(worker => {
                html += `
                    <div style="padding: 0.75rem; border: 1px solid #007bff; margin-bottom: 0.5rem; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${worker.firstName} ${worker.lastName}</strong><br>
                            <small>${worker.email}</small>
                        </div>
                        <button class="btn" onclick="contactWorker('${worker.email}')">📧 Contact</button>
                    </div>
                `;
            });
        }
    }
    
    html += '</div>';
    document.getElementById('scheduleDisplay').innerHTML = html;
    hideAllForms();
};

// Display schedule
function displaySchedule(schedule, isCurrent = false, scheduleId = null) {
    const workerHours = calculateWorkerHours(schedule);
    const totalShifts = Object.values(schedule).flat().length;
    const unfilledShifts = Object.values(schedule).flat().filter(s => s.workers.includes('Unfilled')).length;
    
    let html = '<div class="schedule-display">';
    
    if (isCurrent) {
        html += '<div class="success">✅ This is the current active schedule</div>';
    } else if (scheduleId) {
        html += `<button class="btn btn-success" onclick="publishSchedule('${scheduleId}')" style="width: 100%; margin-bottom: 1rem;">📢 Publish as Current Schedule</button>`;
    }
    
    // Stats
    html += `
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${totalShifts}</div>
                <div class="stat-label">Total Shifts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${unfilledShifts}</div>
                <div class="stat-label">Unfilled</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Object.keys(workerHours).length}</div>
                <div class="stat-label">Workers Assigned</div>
            </div>
        </div>
    `;
    
    // Check work study issues
    const wsIssues = checkWorkStudyIssues(workerHours);
    if (wsIssues.length > 0) {
        html += '<div class="warning"><h5>⚠️ Work Study Issues</h5>';
        wsIssues.forEach(issue => {
            html += `<p>${issue}</p>`;
        });
        html += '</div>';
    }
    
    // Schedule by day
    DAYS.forEach(day => {
        const shifts = schedule[day] || [];
        if (shifts.length === 0) return;
        
        html += `<div class="day-header">${day}</div>`;
        shifts.forEach(shift => {
            const unfilled = shift.workers.includes('Unfilled');
            const workStudy = shift.workStudy;
            html += `
                <div class="shift ${unfilled ? 'unfilled' : ''} ${workStudy ? 'work-study' : ''}">
                    <div>
                        <strong>${formatTime(shift.start)} - ${formatTime(shift.end)}</strong>
                        ${workStudy ? '<span style="color: #ffc107;"> (Work Study)</span>' : ''}
                    </div>
                    <div>${shift.workers.join(', ')}</div>
                </div>
            `;
        });
    });
    
    // Worker summary
    html += '<div class="worker-summary"><h4>Worker Hours Summary</h4>';
    html += '<table class="worker-table"><thead><tr><th>Worker</th><th>Hours</th><th>Status</th></tr></thead><tbody>';
    
    Object.entries(workerHours).forEach(([email, hours]) => {
        const worker = workers.find(w => w.email === email);
        if (!worker) return;
        
        const name = `${worker.firstName} ${worker.lastName}`;
        const isWS = worker.workStudy;
        let status = 'OK';
        let statusColor = '';
        
        if (isWS && hours !== 5) {
            status = `WS Issue (${hours}h)`;
            statusColor = 'color: #dc3545;';
        } else if (hours < 3) {
            status = 'Low Hours';
            statusColor = 'color: #ffc107;';
        }
        
        html += `
            <tr>
                <td>${name} ${isWS ? '<small>(WS)</small>' : ''}</td>
                <td>${hours.toFixed(1)}</td>
                <td style="${statusColor}">${status}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div></div>';
    document.getElementById('scheduleDisplay').innerHTML = html;
}

// Calculate worker hours from schedule
function calculateWorkerHours(schedule) {
    const hours = {};
    
    Object.values(schedule).forEach(shifts => {
        shifts.forEach(shift => {
            const duration = timeToHour(shift.end) - timeToHour(shift.start);
            shift.emails.forEach(email => {
                hours[email] = (hours[email] || 0) + duration;
            });
        });
    });
    
    return hours;
}

// Check work study issues
function checkWorkStudyIssues(workerHours) {
    const issues = [];
    
    workers.forEach(worker => {
        if (worker.workStudy) {
            const hours = workerHours[worker.email] || 0;
            if (hours !== 5) {
                issues.push(`${worker.firstName} ${worker.lastName}: ${hours.toFixed(1)} hours (needs exactly 5)`);
            }
        }
    });
    
    return issues;
}

// Contact worker
window.contactWorker = function(email) {
    window.open(`mailto:${email}?subject=Work Schedule&body=Hello! We have a shift available.`);
};

// Publish schedule
window.publishSchedule = async function(scheduleId) {
    if (confirm('Publish this schedule as the current active schedule?')) {
        try {
            await updateDoc(doc(db, 'workplaces', selectedWorkplace), {
                currentScheduleId: scheduleId,
                updatedAt: new Date().toISOString()
            });
            
            alert('✅ Schedule published successfully!');
            viewCurrentSchedule();
        } catch (error) {
            console.error('Error publishing schedule:', error);
            alert('❌ Error publishing schedule.');
        }
    }
};

// Delete schedule
window.deleteSchedule = async function(scheduleId) {
    if (confirm('Delete this schedule? This cannot be undone.')) {
        try {
            await deleteDoc(doc(db, 'workplaces', selectedWorkplace, 'schedules', scheduleId));
            alert('✅ Schedule deleted.');
            viewHistory();
        } catch (error) {
            console.error('Error deleting schedule:', error);
            alert('❌ Error deleting schedule.');
        }
    }
};

// View schedule by ID
window.viewScheduleById = async function(scheduleId) {
    try {
        const docSnap = await getDoc(doc(db, 'workplaces', selectedWorkplace, 'schedules', scheduleId));
        if (docSnap.exists()) {
            const schedule = docSnap.data().days;
            displaySchedule(schedule, false, scheduleId);
        }
    } catch (error) {
        console.error('Error viewing schedule:', error);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Check auth
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.email) {
        window.location.href = 'index.html';
        return;
    }
    
    loadWorkplaces();
});