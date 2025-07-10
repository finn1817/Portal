import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb } from './firebase-config.js';

// Helper: Parse "Days & Times Available" into an object
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

document.addEventListener('DOMContentLoaded', function() {
    const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
    if (checkAvailabilityBtn) {
        checkAvailabilityBtn.addEventListener('click', checkLastMinuteAvailability);
    }
});

async function checkLastMinuteAvailability() {
    console.log('checkLastMinuteAvailability CALLED');
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
    document.getElementById('lastMinuteResults').style.display = 'block';
    document.getElementById('availableWorkersList').innerHTML = '<div class="loading">🔍 Finding available workers...</div>';
    const workersQuery = collection(workplaceDb, 'workplaces', window.selectedWorkplace, 'workers');
    const querySnapshot = await getDocs(workersQuery);
    const workers = [];
    querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
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
    // Find available workers for the requested slot
    const availableWorkers = workers.filter(worker => {
        const dayAvailability = worker.availability[day] || [];
        return dayAvailability.some(block =>
            block.start_hour <= startHour && endHour <= block.end_hour
        );
    });
    const workStudyAvailable = availableWorkers.filter(w => w.work_study);
    const regularAvailable = availableWorkers.filter(w => !w.work_study);
    // Display results
    let countHtml = `
        <div style="font-size:1.2rem;font-weight:bold;margin-bottom:0.5rem;">
            📋 <strong>${availableWorkers.length}</strong> workers available on <strong>${day}</strong>
            from <strong>${window.formatTimeAMPM(startTime)}</strong> to <strong>${window.formatTimeAMPM(endTime)}</strong>
        </div>
    `;
    if (workStudyAvailable.length > 0) {
        countHtml += `<div style="color:#28a745;">• ${workStudyAvailable.length} Work Study students available</div>`;
    }
    if (regularAvailable.length > 0) {
        countHtml += `<div style="color:#007bff;">• ${regularAvailable.length} Regular workers available</div>`;
    }
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
    if (workStudyAvailable.length > 0) {
        html += `<div style="margin-bottom:1.5rem;"><h6 style="color:#28a745;margin-bottom:0.75rem;font-weight:bold;">🎓 Work Study Students (${workStudyAvailable.length})</h6><div style="border:1px solid #28a745;border-radius:4px;overflow:hidden;">`;
        workStudyAvailable.forEach(worker => {
            html += `
                <div style="padding:1rem;border-bottom:1px solid #dee2e6;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-weight:bold;">${worker.first_name} ${worker.last_name}</div>
                        <div style="font-size:0.9rem;color:#6c757d;">${worker.email}</div>
                    </div>
                    <button onclick="contactWorker('${worker.email}', '${day}', '${startTime}', '${endTime}')"
                        class="contact-btn"
                        style="padding:0.5rem 1rem;background-color:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.9rem;">
                        📧 Contact
                    </button>
                </div>
            `;
        });
        html += '</div></div>';
    }
    if (regularAvailable.length > 0) {
        html += `<div><h6 style="color:#007bff;margin-bottom:0.75rem;font-weight:bold;">👥 Regular Workers (${regularAvailable.length})</h6><div style="border:1px solid #007bff;border-radius:4px;overflow:hidden;">`;
        regularAvailable.forEach(worker => {
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
        html += '</div></div>';
    }
    // Bulk contact options
    if (availableWorkers.length > 1) {
        html += `
            <div style="margin-top:1.5rem;padding:1rem;background:#e9ecef;border-radius:4px;">
                <h6>📧 Bulk Contact Options</h6>
                <button onclick="window.contactAllAvailableWorkers && contactAllAvailableWorkers('${day}', '${startTime}', '${endTime}')"
                        style="padding:0.5rem 1rem;background-color:#17a2b8;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:0.5rem;">
                    Email All Available Workers
                </button>
                <button onclick="window.contactWorkStudyOnly && contactWorkStudyOnly('${day}', '${startTime}', '${endTime}')"
                        style="padding:0.5rem 1rem;background-color:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;">
                    Email Work Study Only
                </button>
            </div>
        `;
    }
    document.getElementById('availableWorkersList').innerHTML = html;
}
window.checkLastMinuteAvailability = checkLastMinuteAvailability;