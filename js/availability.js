// Enhanced last minute availability checking with scheduling integration
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb } from './firebase-config.js';

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
    if (checkAvailabilityBtn) {
        checkAvailabilityBtn.addEventListener('click', checkLastMinuteAvailability);
    }
});

// Enhanced worker availability check with conflict detection
window.isWorkerAvailableDuringHours = function(worker, day, startHour, endHour) {
    const availability = worker.availability || {};
    const dayAvailability = availability[day] || [];
    
    return dayAvailability.some(block => {
        return block.start_hour <= startHour && endHour <= block.end_hour;
    });
};

// Check for scheduling conflicts with current schedule
window.hasWorkerSchedulingConflict = function(worker, day, startHour, endHour, currentSchedule) {
    if (!currentSchedule || !currentSchedule[day]) return false;
    
    const workerEmail = worker.email;
    
    return currentSchedule[day].some(shift => {
        if (!shift.raw_assigned || !shift.raw_assigned.includes(workerEmail)) {
            return false;
        }
        
        const shiftStart = window.timeToHour(shift.start);
        const shiftEnd = window.timeToHour(shift.end);
        
        // Check for time overlap
        return !(endHour <= shiftStart || startHour >= shiftEnd);
    });
};

// Helper: Parse availability text to structured object (reuse from workers.js if needed)
function parseAvailabilityText(availabilityText) {
    const availability = {};
    if (!availabilityText) return availability;

    const blocks = availabilityText.split(',').map(s => s.trim());
    blocks.forEach(block => {
        const match = block.match(/(\w+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/i);
        if (match) {
            let [ , day, start, end ] = match;
            day = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
            const dayMap = {
                'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday',
                'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
            };
            if (dayMap[day]) day = dayMap[day];
            if (!availability[day]) availability[day] = [];
            const startHour = window.timeToHour(start);
            const endHour = window.timeToHour(end);
            if (endHour > startHour) {
                availability[day].push({ start, end, start_hour: startHour, end_hour: endHour });
            }
        }
    });
    return availability;
}

// The main function
async function checkLastMinuteAvailability() {
    if (!window.selectedWorkplace) {
        alert('Please select a workplace first.');
        return;
    }

    const day = document.getElementById('lastMinuteDay').value;
    const startTime = document.getElementById('lastMinuteStart').value;
    const endTime = document.getElementById('lastMinuteEnd').value;

    if (!startTime || !endTime) {
        alert('Please enter both start and end times.');
        return;
    }

    const startHour = window.timeToHour(startTime);
    const endHour = window.timeToHour(endTime);
    if (endHour <= startHour) {
        alert('End time must be after start time.');
        return;
    }

    // Show loading state
    document.getElementById('lastMinuteResults').style.display = 'block';
    document.getElementById('availableWorkersList').innerHTML = '<div class="loading">🔍 Finding available workers...</div>';

    // --- Fetch latest workers from Firestore ---
    const workersQuery = collection(workplaceDb, 'workplaces', window.selectedWorkplace, 'workers');
    const querySnapshot = await getDocs(workersQuery);
    const workers = [];
    querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Parse availability
        let availabilityObj = data.availability || {};
        if (Object.keys(availabilityObj).length === 0 && data['Days & Times Available']) {
            availabilityObj = parseAvailabilityText(data['Days & Times Available']);
        }
        workers.push({
            id: docSnap.id,
            first_name: data['First Name'] || 'Unknown',
            last_name: data['Last Name'] || 'Worker',
            email: data['Email'] || '',
            work_study: data['Work Study'] === 'Yes' || data['Work Study'] === true,
            availability: availabilityObj
        });
    });

    // --- Find available workers for the requested slot ---
    const availableWorkers = workers.filter(worker => {
        const dayAvailability = worker.availability[day] || [];
        return dayAvailability.some(block =>
            block.start_hour <= startHour && endHour <= block.end_hour
        );
    });

    // --- Display results ---
    const countHtml = `
        <div style="font-size:1.2rem;font-weight:bold;margin-bottom:0.5rem;">
            📋 <strong>${availableWorkers.length}</strong> workers available on <strong>${day}</strong>
            from <strong>${window.formatTimeAMPM(startTime)}</strong> to <strong>${window.formatTimeAMPM(endTime)}</strong>
        </div>
    `;
    document.getElementById('availableWorkersCount').innerHTML = countHtml;

    if (availableWorkers.length === 0) {
        document.getElementById('availableWorkersList').innerHTML = `
            <div style="padding:1.5rem;text-align:center;color:#dc3545;background:#f8d7da;border:1px solid #f5c6cb;border-radius:4px;">
                <h5>❌ No workers available during this time slot</h5>
            </div>
        `;
        return;
    }

    let html = '';
    availableWorkers.forEach(worker => {
        html += `
            <div style="padding:1rem;border-bottom:1px solid #dee2e6;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-weight:bold;">${worker.first_name} ${worker.last_name}</div>
                    <div style="font-size:0.9rem;color:#6c757d;">${worker.email}</div>
                </div>
                <button onclick="contactWorker('${worker.email}', '${day}', '${startTime}', '${endTime}')"
                    class="contact-btn"
                    style="padding:0.5rem 1rem;background-color:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.9rem;">
                    📧 Contact
                </button>
            </div>
        `;
    });
    document.getElementById('availableWorkersList').innerHTML = html;
}
window.checkLastMinuteAvailability = checkLastMinuteAvailability;

// Check if requested time is within operating hours
function checkIfWithinOperatingHours(day, startHour, endHour, hoursOfOperation) {
    const dayHours = hoursOfOperation[day] || [];
    
    return dayHours.some(period => {
        return period.start_hour <= startHour && endHour <= period.end_hour;
    });
}

// Display enhanced availability results with detailed information
function displayEnhancedAvailabilityResults(day, startTime, endTime, workStudyAvailable, regularAvailable, isWithinOperatingHours, workerCurrentHours) {
    const totalAvailable = workStudyAvailable.length + regularAvailable.length;
    
    // Update count with enhanced information
    let countHtml = `
        <div style="margin-bottom: 1rem;">
            <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem;">
                📋 <strong>${totalAvailable}</strong> workers available on <strong>${day}</strong> 
                from <strong>${window.formatTimeAMPM(startTime)}</strong> to <strong>${window.formatTimeAMPM(endTime)}</strong>
            </div>
    `;
    
    if (!isWithinOperatingHours) {
        countHtml += `
            <div style="padding: 0.75rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; margin-bottom: 1rem;">
                ⚠️ <strong>Notice:</strong> This time slot is outside normal operating hours.
            </div>
        `;
    }
    
    if (workStudyAvailable.length > 0) {
        countHtml += `<div style="color: #28a745;">• ${workStudyAvailable.length} Work Study students available</div>`;
    }
    
    if (regularAvailable.length > 0) {
        countHtml += `<div style="color: #007bff;">• ${regularAvailable.length} Regular workers available</div>`;
    }
    
    countHtml += '</div>';
    
    document.getElementById('availableWorkersCount').innerHTML = countHtml;
    
    if (totalAvailable === 0) {
        document.getElementById('availableWorkersList').innerHTML = `
            <div style="padding: 1.5rem; text-align: center; color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
                <h5>❌ No workers available during this time slot</h5>
                <p>Suggestions:</p>
                <ul style="text-align: left; margin-top: 1rem;">
                    <li>Check if the time falls within operating hours</li>
                    <li>Consider adjusting the time slightly</li>
                    <li>Contact workers directly to ask about availability changes</li>
                    <li>Check if any workers might be able to swap shifts</li>
                </ul>
            </div>
        `;
        return;
    }
    
    // Generate enhanced worker list
    let html = '';
    
    // Work Study section
    if (workStudyAvailable.length > 0) {
        html += `
            <div style="margin-bottom: 1.5rem;">
                <h6 style="color: #28a745; margin-bottom: 0.75rem; font-weight: bold;">
                    🎓 Work Study Students (${workStudyAvailable.length})
                </h6>
                <div style="border: 1px solid #28a745; border-radius: 4px; overflow: hidden;">
        `;
        
        workStudyAvailable.forEach((worker, index) => {
            const currentHours = workerCurrentHours[worker.email] || 0;
            const hoursStatus = currentHours >= 5 ? 
                `<span style="color: #ffc107;">Already at 5 hours</span>` : 
                `<span style="color: #28a745;">${currentHours.toFixed(1)}/5.0 hours</span>`;
            
            html += generateWorkerAvailabilityRow(worker, hoursStatus, index === 0, day, startTime, endTime);
        });
        
        html += '</div></div>';
    }
    
    // Regular Workers section
    if (regularAvailable.length > 0) {
        html += `
            <div>
                <h6 style="color: #007bff; margin-bottom: 0.75rem; font-weight: bold;">
                    👥 Regular Workers (${regularAvailable.length})
                </h6>
                <div style="border: 1px solid #007bff; border-radius: 4px; overflow: hidden;">
        `;
        
        // Sort regular workers by current hours (ascending - prioritize those with fewer hours)
        regularAvailable.sort((a, b) => {
            const hoursA = workerCurrentHours[a.email] || 0;
            const hoursB = workerCurrentHours[b.email] || 0;
            return hoursA - hoursB;
        });
        
        regularAvailable.forEach((worker, index) => {
            const currentHours = workerCurrentHours[worker.email] || 0;
            const hoursStatus = `<span style="color: #007bff;">${currentHours.toFixed(1)} hours this week</span>`;
            
            html += generateWorkerAvailabilityRow(worker, hoursStatus, index === 0, day, startTime, endTime);
        });
        
        html += '</div></div>';
    }
    
    // Add bulk contact option
    if (totalAvailable > 1) {
        html += `
            <div style="margin-top: 1.5rem; padding: 1rem; background: #e9ecef; border-radius: 4px;">
                <h6>📧 Bulk Contact Options</h6>
                <button onclick="contactAllAvailableWorkers('${day}', '${startTime}', '${endTime}')" 
                        style="padding: 0.5rem 1rem; background-color: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;">
                    Email All Available Workers
                </button>
                <button onclick="contactWorkStudyOnly('${day}', '${startTime}', '${endTime}')" 
                        style="padding: 0.5rem 1rem; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Email Work Study Only
                </button>
            </div>
        `;
    }
    
    document.getElementById('availableWorkersList').innerHTML = html;
}

// Generate individual worker availability row
function generateWorkerAvailabilityRow(worker, hoursStatus, isFirst, day, startTime, endTime) {
    return `
        <div style="padding: 1rem; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; ${isFirst ? '' : 'border-top: 1px solid #f8f9fa;'}">
            <div style="flex: 1;">
                <div style="font-weight: bold; margin-bottom: 0.25rem;">
                    ${worker.first_name} ${worker.last_name}
                </div>
                <div style="font-size: 0.9rem; color: #6c757d;">
                    ${hoursStatus}
                </div>
                <div style="font-size: 0.8rem; color: #6c757d; margin-top: 0.25rem;">
                    📧 ${worker.email}
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="contactWorker('${worker.email}', '${day}', '${startTime}', '${endTime}')" 
                        class="contact-btn" 
                        style="padding: 0.5rem 1rem; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                    📧 Contact
                </button>
                <button onclick="viewWorkerSchedule('${worker.email}')" 
                        style="padding: 0.5rem 1rem; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                    📅 Schedule
                </button>
            </div>
        </div>
    `;
}

// Enhanced contact worker function with better email template
window.contactWorker = function(email, day, startTime, endTime) {
    const urgencyLevel = determineUrgencyLevel(day, startTime);
    const subject = `${urgencyLevel} Shift Coverage: ${day} ${window.formatTimeAMPM(startTime)}-${window.formatTimeAMPM(endTime)}`;
    
    const body = `Hello,

We need ${urgencyLevel.toLowerCase()} coverage for a shift:

📅 Day: ${day}
🕐 Time: ${window.formatTimeAMPM(startTime)} to ${window.formatTimeAMPM(endTime)}
🏢 Location: ${window.selectedWorkplace.replace('_', ' ').toUpperCase()}

Please respond as soon as possible if you are available to cover this shift.

If you cannot work this shift, please let us know if you have any suggestions for alternative coverage.

Thank you for your flexibility!

Best regards,
${window.selectedWorkplace.replace('_', ' ').toUpperCase()} Management

---
This is an automated message. Please reply to confirm your availability.`;

    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
};

// Determine urgency level based on timing
function determineUrgencyLevel(day, startTime) {
    const today = new Date();
    const requestedDate = getNextDateForDay(day);
    const hoursDifference = (requestedDate - today) / (1000 * 60 * 60);
    
    if (hoursDifference < 24) {
        return 'URGENT';
    } else if (hoursDifference < 48) {
        return 'Priority';
    } else {
        return 'Shift Coverage Request';
    }
}

// Get next date for a specific day
function getNextDateForDay(dayName) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDay = days.indexOf(dayName);
    const today = new Date();
    const currentDay = today.getDay();
    
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
        daysUntilTarget += 7; // Next week
    }
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    return targetDate;
}

// Contact all available workers
window.contactAllAvailableWorkers = function(day, startTime, endTime) {
    const allEmails = [...window.workers]
        .filter(worker => window.isWorkerAvailableDuringHours(worker, day, window.timeToHour(startTime), window.timeToHour(endTime)))
        .map(worker => worker.email);
    
    if (allEmails.length === 0) {
        alert('No available workers to contact.');
        return;
    }
    
    const subject = `Shift Coverage Needed: ${day} ${window.formatTimeAMPM(startTime)}-${window.formatTimeAMPM(endTime)}`;
    const body = `Hello everyone,

We need coverage for a shift on ${day} from ${window.formatTimeAMPM(startTime)} to ${window.formatTimeAMPM(endTime)}.

If you are available and interested in picking up this shift, please reply to this email as soon as possible.

First to respond gets the shift!

Thank you,
${window.selectedWorkplace.replace('_', ' ').toUpperCase()} Management`;

    const mailtoLink = `mailto:${allEmails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
};

// Contact work study workers only
window.contactWorkStudyOnly = function(day, startTime, endTime) {
    const workStudyEmails = window.workers
        .filter(worker => 
            worker.work_study && 
            window.isWorkerAvailableDuringHours(worker, day, window.timeToHour(startTime), window.timeToHour(endTime))
        )
        .map(worker => worker.email);
    
    if (workStudyEmails.length === 0) {
        alert('No available work study students to contact.');
        return;
    }
    
    const subject = `Work Study Shift Available: ${day} ${window.formatTimeAMPM(startTime)}-${window.formatTimeAMPM(endTime)}`;
    const body = `Hello Work Study Students,

We have a shift available specifically for work study students:

📅 Day: ${day}
🕐 Time: ${window.formatTimeAMPM(startTime)} to ${window.formatTimeAMPM(endTime)}
🏢 Location: ${window.selectedWorkplace.replace('_', ' ').toUpperCase()}

This shift can count toward your work study hours requirement.

If you are available and interested, please reply as soon as possible.

Thank you,
${window.selectedWorkplace.replace('_', ' ').toUpperCase()} Management`;

    const mailtoLink = `mailto:${workStudyEmails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
};

// View worker's current schedule (placeholder for future implementation)
window.viewWorkerSchedule = function(email) {
    alert(`Worker schedule view for ${email} will be implemented in a future update.\n\nThis feature will show:\n• Current week schedule\n• Total hours assigned\n• Available time slots\n• Recent shift history`);
};

// Helper function to get worker assigned hours (if schedule functions are available)
window.getWorkerAssignedHours = function(worker, schedule) {
    if (!schedule || !worker.email) return 0;
    
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

// Export enhanced functions
export { 
    checkLastMinuteAvailability,
    displayEnhancedAvailabilityResults,
    determineUrgencyLevel 
};