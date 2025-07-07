// Last minute availability checking
import { workplaceDb } from './firebase-config.js';

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
    if (checkAvailabilityBtn) {
        checkAvailabilityBtn.addEventListener('click', checkLastMinuteAvailability);
    }
});

// Check if worker is available during specific hours
window.isWorkerAvailableDuringHours = function(worker, day, startHour, endHour) {
    const availability = worker.availability || {};
    const dayAvailability = availability[day] || [];
    
    return dayAvailability.some(block => {
        return block.start_hour <= startHour && endHour <= block.end_hour;
    });
};

// Check last minute availability
window.checkLastMinuteAvailability = async function() {
    if (!window.selectedWorkplace) {
        alert('Please select a workplace first.');
        return;
    }
    
    const day = document.getElementById('lastMinuteDay').value;
    const startTime = document.getElementById('lastMinuteStart').value;
    const endTime = document.getElementById('lastMinuteEnd').value;
    
    // Validate times
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
    document.getElementById('availableWorkersList').innerHTML = '<div class="loading">Finding available workers...</div>';
    
    try {
        // Find available workers
        const availableWorkers = window.workers.filter(worker => 
            window.isWorkerAvailableDuringHours(worker, day, startHour, endHour)
        );
        
        // Display results
        document.getElementById('availableWorkersCount').innerHTML = `
            <strong>${availableWorkers.length}</strong> workers available on <strong>${day}</strong> 
            from <strong>${window.formatTimeAMPM(startTime)}</strong> to <strong>${window.formatTimeAMPM(endTime)}</strong>.
        `;
        
        if (availableWorkers.length === 0) {
            document.getElementById('availableWorkersList').innerHTML = `
                <p style="padding: 1rem; color: #dc3545;">No workers available during this time slot.</p>
            `;
        } else {
            let html = '';
            
            // Sort work study students first
            availableWorkers.sort((a, b) => {
                if (a.work_study && !b.work_study) return -1;
                if (!a.work_study && b.work_study) return 1;
                return 0;
            });
            
            availableWorkers.forEach(worker => {
                html += `
                    <div class="available-worker-item">
                        <div>
                            <strong>${worker.first_name} ${worker.last_name}</strong> 
                            ${worker.work_study ? '<span style="color: #28a745;">(Work Study)</span>' : ''}
                        </div>
                        <button class="contact-btn" onclick="contactWorker('${worker.email}', '${day}', '${startTime}', '${endTime}')">
                            📧 Contact
                        </button>
                    </div>
                `;
            });
            
            document.getElementById('availableWorkersList').innerHTML = html;
        }
    } catch (error) {
        console.error('❌ Error checking availability:', error);
        document.getElementById('availableWorkersList').innerHTML = `
            <p style="padding: 1rem; color: #dc3545;">Error checking availability: ${error.message}</p>
        `;
    }
};

// Contact worker for last minute availability
window.contactWorker = function(email, day, startTime, endTime) {
    const subject = `Urgent Shift Coverage: ${day} ${window.formatTimeAMPM(startTime)}-${window.formatTimeAMPM(endTime)}`;
    const body = `Hello,

We need coverage for a shift on ${day} from ${window.formatTimeAMPM(startTime)} to ${window.formatTimeAMPM(endTime)}.

Please let me know if you are available.

Thank you,
${window.selectedWorkplace.replace('_', ' ').toUpperCase()} Management`;

    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
};
