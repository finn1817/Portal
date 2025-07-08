// Worker management with enhanced scheduling support
import { collection, getDocs, doc, deleteDoc, addDoc, query, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb } from './firebase-config.js';

// Global workers array
window.workers = [];

// Add event listeners for worker management
document.addEventListener('DOMContentLoaded', function() {
    const addWorkerBtn = document.getElementById('addWorkerBtn');
    if (addWorkerBtn) {
        addWorkerBtn.addEventListener('click', function() {
            addWorker();
        });
    }
});

// Load workers with enhanced scheduling data
window.loadWorkers = async function(workplace) {
    try {
        document.getElementById('workersLoading').style.display = 'block';
        document.getElementById('workersContainer').style.display = 'none';
        
        // Ensure workplace document exists
        await window.initializeWorkplace(workplace);
        
        console.log(`🔍 Loading workers from workplaces/${workplace}/workers collection`);
        
        // Query the workers collection under the workplace
        const workersQuery = query(collection(workplaceDb, 'workplaces', workplace, 'workers'));
        const querySnapshot = await getDocs(workersQuery);
        
        window.workers = []; // Reset global workers array
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('📄 Full worker document:', data);
            
            // Use EXACT field names with spaces from Firebase
            const firstName = data['First Name'] || 'Unknown';
            const lastName = data['Last Name'] || 'Worker';
            const email = data['Email'] || 'no-email@example.com';
            const workStudy = data['Work Study'] || 'No';
            const availability = data['Days & Times Available'] || 'Not set';
            
            console.log('✅ Extracted fields:', { firstName, lastName, email, workStudy, availability });
            
            // Parse availability text to structured format if not already done
            let availabilityObj = data.availability || {};
            if (Object.keys(availabilityObj).length === 0 && availability !== 'Not set') {
                availabilityObj = parseAvailabilityText(availability);
            }
            
            // Calculate total availability hours for scheduling fairness
            const totalAvailabilityHours = calculateAvailabilityHours(availabilityObj);
            
            window.workers.push({
                id: doc.id,
                first_name: firstName,
                last_name: lastName,
                email: email,
                work_study: workStudy === 'Yes' || workStudy === true,
                availability_text: availability,
                availability: availabilityObj,
                total_availability_hours: totalAvailabilityHours,
                ...data // Include all original data
            });
        });

        console.log(`✅ Found ${window.workers.length} workers in ${workplace}`);
        displayWorkers(window.workers);
        
        // Validate work study availability for scheduling
        validateWorkStudyAvailability();
        
    } catch (error) {
        console.error('❌ Error loading workers:', error);
        document.getElementById('workersLoading').textContent = 'Error loading workers: ' + error.message;
    }
};

// Calculate total availability hours per worker
function calculateAvailabilityHours(availability) {
    let totalHours = 0;
    for (const daySlots of Object.values(availability)) {
        for (const slot of daySlots) {
            totalHours += slot.end_hour - slot.start_hour;
        }
    }
    return totalHours;
}

// Validate work study student availability
function validateWorkStudyAvailability() {
    const workStudyWorkers = window.workers.filter(w => w.work_study);
    const issues = [];
    
    for (const worker of workStudyWorkers) {
        if (worker.total_availability_hours < 5) {
            issues.push(`${worker.first_name} ${worker.last_name}: Only ${worker.total_availability_hours.toFixed(1)} hours available (needs 5)`);
        }
    }
    
    if (issues.length > 0) {
        console.warn('⚠️ Work Study Availability Issues:', issues);
        // Could show a warning in the UI if needed
    }
}

// Enhanced display workers with availability insights
function displayWorkers(workersData) {
    const tbody = document.getElementById('workersTableBody');
    tbody.innerHTML = '';

    if (workersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #6c757d;">No workers found. Add some workers to get started!</td></tr>';
    } else {
        workersData.forEach((worker) => {
            const row = document.createElement('tr');
            
            // Use the cleaned field names
            const name = `${worker.first_name} ${worker.last_name}`;
            const email = worker.email;
            const workStudy = worker.work_study;
            const availability = worker.availability_text;
            
            // Add styling for work study students with insufficient availability
            let rowClass = '';
            if (workStudy && worker.total_availability_hours < 5) {
                rowClass = 'style="background-color: rgba(220, 53, 69, 0.1);"';
            }
            
            console.log('🎯 Displaying worker:', { name, email, workStudy, availability });
            
            row.innerHTML = `
                <td ${rowClass}>${name} ${workStudy && worker.total_availability_hours < 5 ? '<small style="color: #dc3545;">(⚠️ Low Avail.)</small>' : ''}</td>
                <td>${email}</td>
                <td>
                    <span class="status-badge ${(workStudy === 'Yes' || workStudy === true) ? 'status-admin' : 'status-user'}">
                        ${workStudy === 'Yes' || workStudy === true ? 'Yes' : 'No'}
                    </span>
                </td>
                <td style="max-width: 200px; word-wrap: break-word;">
                    ${availability}
                    ${worker.total_availability_hours ? `<br><small style="color: #6c757d;">(${worker.total_availability_hours.toFixed(1)} hrs/week)</small>` : ''}
                </td>
                <td>
                    <button class="action-btn delete-btn" onclick="deleteWorker('${worker.id}', '${name}')">
                        🗑️ Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    document.getElementById('workersLoading').style.display = 'none';
    document.getElementById('workersContainer').style.display = 'block';
}

// Enhanced worker addition with availability validation
window.addWorker = async function() {
    if (!window.selectedWorkplace) {
        alert('Please select a workplace first.');
        return;
    }

    const firstName = document.getElementById('workerFirstName').value.trim();
    const lastName = document.getElementById('workerLastName').value.trim();
    const email = document.getElementById('workerEmail').value.trim();
    const workStudy = document.getElementById('workerWorkStudy').value;
    const availability = document.getElementById('workerAvailability').value.trim();

    if (!firstName || !lastName || !email) {
        alert('Please fill in all required fields (First Name, Last Name, Email).');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return;
    }

    try {
        // Ensure workplace document exists
        await window.initializeWorkplace(window.selectedWorkplace);
        
        console.log(`➕ Adding worker to workplaces/${window.selectedWorkplace}/workers collection`);
        
        // Parse availability text to structured format
        const availabilityObj = parseAvailabilityText(availability);
        const totalAvailabilityHours = calculateAvailabilityHours(availabilityObj);
        
        // Validate work study availability
        if (workStudy === 'Yes' && totalAvailabilityHours < 5) {
            const proceed = confirm(
                `⚠️ Warning: This work study student only has ${totalAvailabilityHours.toFixed(1)} hours of availability per week.\n\n` +
                `Work study students need exactly 5 hours per week. Do you want to add them anyway?`
            );
            if (!proceed) return;
        }
        
        // Check for duplicate email
        const existingWorker = window.workers.find(w => w.email.toLowerCase() === email.toLowerCase());
        if (existingWorker) {
            alert('A worker with this email already exists.');
            return;
        }
        
        // Create the new worker object using EXACT field names with spaces
        const newWorker = {
            'First Name': firstName,
            'Last Name': lastName,
            'Email': email,
            'Work Study': workStudy,
            'Days & Times Available': availability,
            'availability': availabilityObj, // Add the parsed availability object
            'total_availability_hours': totalAvailabilityHours,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add to workers subcollection
        await addDoc(collection(workplaceDb, 'workplaces', window.selectedWorkplace, 'workers'), newWorker);

        alert('✅ Worker added successfully!');
        
        // Clear form
        document.getElementById('workerFirstName').value = '';
        document.getElementById('workerLastName').value = '';
        document.getElementById('workerEmail').value = '';
        document.getElementById('workerWorkStudy').value = 'No';
        document.getElementById('workerAvailability').value = '';
        
        // Reload workers
        window.loadWorkers(window.selectedWorkplace);
    } catch (error) {
        console.error('❌ Error adding worker:', error);
        alert('❌ Error adding worker: ' + error.message);
    }
};

// Delete a worker with confirmation
window.deleteWorker = async function(workerId, workerName) {
    if (confirm(`⚠️ Are you sure you want to delete "${workerName}"?\n\nThis action cannot be undone.`)) {
        try {
            console.log(`🗑️ Deleting worker ${workerId} from workplaces/${window.selectedWorkplace}/workers`);
            
            await deleteDoc(doc(workplaceDb, 'workplaces', window.selectedWorkplace, 'workers', workerId));
            alert(`✅ Worker "${workerName}" has been deleted successfully.`);
            window.loadWorkers(window.selectedWorkplace);
        } catch (error) {
            console.error('❌ Error deleting worker:', error);
            alert('❌ Error deleting worker: ' + error.message);
        }
    }
};

// Enhanced availability text parsing with better error handling
function parseAvailabilityText(availabilityText) {
    const availability = {};
    if (!availabilityText) return availability;

    const blocks = availabilityText.split(',').map(s => s.trim());
    
    blocks.forEach(block => {
        // Enhanced regex to handle various time formats
        const match = block.match(/(\w+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/i);
        if (match) {
            const [, day, start, end] = match;
            
            // Capitalize first letter and lowercase the rest
            let dayName = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
            
            // Handle shortened day names
            const dayMap = {
                'Mon': 'Monday',
                'Tue': 'Tuesday',
                'Wed': 'Wednesday',
                'Thu': 'Thursday',
                'Fri': 'Friday',
                'Sat': 'Saturday',
                'Sun': 'Sunday'
            };
            
            if (dayMap[dayName]) {
                dayName = dayMap[dayName];
            }
            
            // Validate day name
            const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            if (!validDays.includes(dayName)) {
                console.warn(`Invalid day name: ${dayName}`);
                return;
            }
            
            if (!availability[dayName]) {
                availability[dayName] = [];
            }
            
            const startHour = window.timeToHour(start);
            const endHour = window.timeToHour(end);
            
            // Validate time range
            if (endHour <= startHour) {
                console.warn(`Invalid time range: ${start}-${end} on ${dayName}`);
                return;
            }
            
            availability[dayName].push({
                start: start,
                end: end,
                start_hour: startHour,
                end_hour: endHour
            });
        } else {
            console.warn(`Could not parse availability block: ${block}`);
        }
    });
    
    return availability;
}

// Enhanced worker loading for scheduling with better data structure
window.loadWorkersForScheduling = async function(workplace) {
    if (window.workers.length > 0) {
        // Use already loaded workers if available, but ensure they have scheduling data
        return window.workers.map(worker => ({
            ...worker,
            // Ensure all required fields for scheduling
            first_name: worker.first_name || 'Unknown',
            last_name: worker.last_name || 'Worker',
            email: worker.email || 'no-email@example.com',
            work_study: worker.work_study === 'Yes' || worker.work_study === true,
            availability: worker.availability || {},
            total_availability_hours: worker.total_availability_hours || 0
        }));
    }
    
    // Ensure workplace document exists
    await window.initializeWorkplace(workplace);
    
    const workersQuery = query(collection(workplaceDb, 'workplaces', workplace, 'workers'));
    const querySnapshot = await getDocs(workersQuery);
    
    const workersData = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Extract worker data with proper field names
        const firstName = data['First Name'] || 'Unknown';
        const lastName = data['Last Name'] || 'Worker';
        const email = data['Email'] || 'no-email@example.com';
        const workStudy = data['Work Study'] || 'No';
        const availabilityText = data['Days & Times Available'] || '';
        
        // Either use existing availability object or parse from text
        let availabilityObj = data.availability || {};
        if (Object.keys(availabilityObj).length === 0 && availabilityText) {
            availabilityObj = parseAvailabilityText(availabilityText);
        }
        
        const totalAvailabilityHours = calculateAvailabilityHours(availabilityObj);
        
        workersData.push({
            id: doc.id,
            first_name: firstName,
            last_name: lastName,
            email: email,
            work_study: workStudy === 'Yes' || workStudy === true,
            availability_text: availabilityText,
            availability: availabilityObj,
            total_availability_hours: totalAvailabilityHours
        });
    });
    
    window.workers = workersData;
    return workersData;
};

// Check if worker is available during specific hours (enhanced version)
window.isWorkerAvailableDuringHours = function(worker, day, startHour, endHour) {
    const availability = worker.availability || {};
    const dayAvailability = availability[day] || [];
    
    return dayAvailability.some(block => {
        // Check if the requested time slot is completely within an availability block
        return block.start_hour <= startHour && endHour <= block.end_hour;
    });
};

// Check for scheduling conflicts for a worker
window.hasSchedulingConflict = function(worker, day, startHour, endHour, currentSchedule) {
    if (!currentSchedule || !currentSchedule[day]) return false;
    
    const workerEmail = worker.email;
    
    // Check if worker is already scheduled during this time
    return currentSchedule[day].some(shift => {
        if (!shift.raw_assigned || !shift.raw_assigned.includes(workerEmail)) {
            return false;
        }
        
        const shiftStart = window.timeToHour(shift.start);
        const shiftEnd = window.timeToHour(shift.end);
        
        // Check for overlap
        return !(endHour <= shiftStart || startHour >= shiftEnd);
    });
};

// Get worker's current assigned hours from a schedule
window.getWorkerAssignedHours = function(worker, schedule) {
    let totalHours = 0;
    const workerEmail = worker.email;
    
    for (const [day, shifts] of Object.entries(schedule)) {
        for (const shift of shifts) {
            if (shift.raw_assigned && shift.raw_assigned.includes(workerEmail)) {
                const startHour = window.timeToHour(shift.start);
                const endHour = window.timeToHour(shift.end);
                totalHours += (endHour - startHour);
            }
        }
    }
    
    return totalHours;
};

// Calculate fairness ratio for scheduling algorithm
window.calculateWorkerFairnessRatio = function(worker, assignedHours) {
    const availabilityHours = worker.total_availability_hours || 1; // Avoid division by zero
    const currentAssigned = assignedHours[worker.email] || 0;
    
    return currentAssigned / availabilityHours;
};

// Export functions
export { 
    parseAvailabilityText, 
    displayWorkers, 
    calculateAvailabilityHours,
    validateWorkStudyAvailability 
};