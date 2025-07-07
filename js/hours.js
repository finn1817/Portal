// Hours of operation management
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb, DAYS } from '/Portal/js/firebase-config.js';

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    const saveHoursBtn = document.getElementById('saveHoursBtn');
    if (saveHoursBtn) {
        saveHoursBtn.addEventListener('click', function() {
            saveHours();
        });
    }
});

// Load hours of operation
window.loadHours = async function(workplace) {
    try {
        document.getElementById('hoursLoading').style.display = 'block';
        
        // Ensure workplace document exists
        await window.initializeWorkplace(workplace);
        
        console.log(`🔍 Loading hours for workplaces/${workplace}`);
        
        // Get the workplace document which contains hours_of_operation
        const workplaceRef = doc(workplaceDb, 'workplaces', workplace);
        const workplaceDoc = await getDoc(workplaceRef);
        
        if (workplaceDoc.exists()) {
            const data = workplaceDoc.data();
            const hoursOfOperation = data.hours_of_operation || {};
            
            console.log('📄 Hours of operation:', hoursOfOperation);
            displayHours(hoursOfOperation);
        } else {
            console.log('❌ Workplace document does not exist');
            displayHours({});
        }
        
        document.getElementById('hoursLoading').style.display = 'none';
    } catch (error) {
        console.error('❌ Error loading hours:', error);
        document.getElementById('hoursLoading').style.display = 'none';
    }
};

// Display hours in editable form
function displayHours(hoursOfOperation) {
    const container = document.getElementById('hoursSchedule');
    
    container.innerHTML = '';
    
    DAYS.forEach(day => {
        const dayHours = hoursOfOperation[day] || [];
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-schedule';
        
        dayDiv.innerHTML = `
            <label><strong>${day}</strong></label>
            <input type="time" id="${day}_start" value="${dayHours[0]?.start || '09:00'}">
            <input type="time" id="${day}_end" value="${dayHours[0]?.end || '17:00'}">
            <label>
                <input type="checkbox" id="${day}_enabled" ${dayHours.length > 0 ? 'checked' : ''}>
                Open
            </label>
        `;
        
        container.appendChild(dayDiv);
    });

    // Display current hours summary
    document.getElementById('hoursContent').innerHTML = generateHoursSummary(hoursOfOperation);
}

// Generate hours summary HTML
function generateHoursSummary(hoursOfOperation) {
    if (Object.keys(hoursOfOperation).length === 0) {
        return '<p>No hours of operation set.</p>';
    }

    let html = '<h5>Current Hours:</h5><ul>';
    for (const [day, hours] of Object.entries(hoursOfOperation)) {
        if (hours && hours.length > 0) {
            html += `<li><strong>${day}:</strong> ${window.formatTimeAMPM(hours[0].start)} - ${window.formatTimeAMPM(hours[0].end)}</li>`;
        }
    }
    html += '</ul>';
    return html;
}

// Save hours of operation
window.saveHours = async function() {
    if (!window.selectedWorkplace) {
        alert('Please select a workplace first.');
        return;
    }

    try {
        // Ensure workplace document exists
        await window.initializeWorkplace(window.selectedWorkplace);
        
        const hoursOfOperation = {};

        DAYS.forEach(day => {
            const enabled = document.getElementById(`${day}_enabled`).checked;
            if (enabled) {
                const start = document.getElementById(`${day}_start`).value;
                const end = document.getElementById(`${day}_end`).value;
                
                hoursOfOperation[day] = [{
                    start: start,
                    end: end,
                    start_hour: window.timeToHour(start),
                    end_hour: window.timeToHour(end)
                }];
            }
        });

        console.log(`💾 Saving hours for ${window.selectedWorkplace}:`, hoursOfOperation);

        // Update the workplace document
        const workplaceRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace);
        await updateDoc(workplaceRef, {
            hours_of_operation: hoursOfOperation,
            updated_at: new Date().toISOString()
        });

        alert('✅ Hours of operation saved successfully!');
        displayHours(hoursOfOperation);
    } catch (error) {
        console.error('❌ Error saving hours:', error);
        alert('❌ Error saving hours: ' + error.message);
    }
};

// Load hours for scheduling (helper function)
window.loadHoursForScheduling = async function(workplace) {
    // Ensure workplace document exists
    await window.initializeWorkplace(workplace);
    
    const workplaceRef = doc(workplaceDb, 'workplaces', workplace);
    const workplaceDoc = await getDoc(workplaceRef);
    
    if (workplaceDoc.exists()) {
        return workplaceDoc.data().hours_of_operation || {};
    }
    return {};
};

// Export functions
export { displayHours, generateHoursSummary };
