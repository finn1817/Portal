// Enhanced hours of operation management with scheduling integration
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb, DAYS } from './firebase-config.js';

// Time utility functions
window.timeToHour = window.timeToHour || function(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    let hourNum = hours + (minutes / 60);
    
    // Handle midnight (00:00) as 24 hours for end times
    if (hours === 0 && minutes === 0) hourNum = 24; 
    
    return hourNum;
};

window.formatTimeAMPM = window.formatTimeAMPM || function(timeStr) {
    if (!timeStr) return '';
    
    let [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM
    
    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    const saveHoursBtn = document.getElementById('saveHoursBtn');
    if (saveHoursBtn) {
        saveHoursBtn.addEventListener('click', function() {
            saveHours();
        });
    }
});

// Load hours of operation with validation
window.loadHours = async function(workplace) {
    if (!workplace) return;
    
    try {
        const hoursLoading = document.getElementById('hoursLoading');
        if (hoursLoading) {
            hoursLoading.style.display = 'block';
        }
        
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
            
            // Validate hours for scheduling
            validateHoursForScheduling(hoursOfOperation);
        } else {
            console.log('❌ Workplace document does not exist');
            displayHours({});
        }
        
        if (hoursLoading) {
            hoursLoading.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ Error loading hours:', error);
        const hoursLoading = document.getElementById('hoursLoading');
        if (hoursLoading) {
            hoursLoading.style.display = 'none';
        }
    }
};

// Validate hours for scheduling compatibility
function validateHoursForScheduling(hoursOfOperation) {
    const totalOperatingHours = calculateTotalOperatingHours(hoursOfOperation);
    const operatingDays = Object.keys(hoursOfOperation).length;
    
    if (totalOperatingHours < 10) {
        console.warn(`⚠️ Low operating hours: ${totalOperatingHours.toFixed(1)} hours per week`);
    }
    
    if (operatingDays < 3) {
        console.warn(`⚠️ Few operating days: ${operatingDays} days per week`);
    }
    
    // Check for scheduling conflicts (very short operating periods)
    for (const [day, hours] of Object.entries(hoursOfOperation)) {
        for (const period of hours) {
            const duration = (period.end_hour || window.timeToHour(period.end)) - (period.start_hour || window.timeToHour(period.start));
            if (duration < 2) {
                console.warn(`⚠️ Short operating period on ${day}: ${duration} hours`);
            }
        }
    }
}

// Calculate total operating hours per week
function calculateTotalOperatingHours(hoursOfOperation) {
    let total = 0;
    for (const dayHours of Object.values(hoursOfOperation)) {
        for (const period of dayHours) {
            const startHour = period.start_hour || window.timeToHour(period.start);
            const endHour = period.end_hour || window.timeToHour(period.end);
            total += endHour - startHour;
        }
    }
    return total;
}

// Enhanced display hours in editable form with validation
function displayHours(hoursOfOperation) {
    const container = document.getElementById('hoursSchedule');
    if (!container) {
        console.error('hoursSchedule container not found');
        return;
    }
    
    container.innerHTML = '';
    
    // Add styling for the hours grid
    container.style.cssText = 'display: grid; gap: 0.5rem;';
    
    DAYS.forEach(day => {
        const dayHours = hoursOfOperation[day] || [];
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-schedule';
        dayDiv.style.cssText = 'display: grid; grid-template-columns: 120px 1fr 1fr 120px; gap: 1rem; align-items: center; padding: 1rem; border: 1px solid #eee; border-radius: 4px; background: white;';
        
        const startValue = dayHours[0]?.start || '09:00';
        const endValue = dayHours[0]?.end || '17:00';
        const isEnabled = dayHours.length > 0;
        
        dayDiv.innerHTML = `
            <label><strong>${day}</strong></label>
            <div>
                <label style="font-size: 0.9rem; display: block; margin-bottom: 0.25rem;">Start:</label>
                <input type="time" id="${day}_start" value="${startValue}" 
                       style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;"
                       onchange="validateHourInput('${day}')">
            </div>
            <div>
                <label style="font-size: 0.9rem; display: block; margin-bottom: 0.25rem;">End:</label>
                <input type="time" id="${day}_end" value="${endValue}"
                       style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;"
                       onchange="validateHourInput('${day}')">
            </div>
            <label style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" id="${day}_enabled" ${isEnabled ? 'checked' : ''}
                       onchange="toggleDayEnabled('${day}')">
                <span>Open</span>
            </label>
        `;
        
        container.appendChild(dayDiv);
        
        // Update disabled state
        updateDayInputsState(day, isEnabled);
    });

    // Display current hours summary with analytics
    const hoursContent = document.getElementById('hoursContent');
    if (hoursContent) {
        hoursContent.innerHTML = generateEnhancedHoursSummary(hoursOfOperation);
    }
}

// Toggle day enabled/disabled state
window.toggleDayEnabled = function(day) {
    const enabled = document.getElementById(`${day}_enabled`).checked;
    updateDayInputsState(day, enabled);
    
    // Validate the change
    if (enabled) {
        validateHourInput(day);
    }
};

// Update input states for a day
function updateDayInputsState(day, enabled) {
    const startInput = document.getElementById(`${day}_start`);
    const endInput = document.getElementById(`${day}_end`);
    
    if (startInput && endInput) {
        startInput.disabled = !enabled;
        endInput.disabled = !enabled;
        
        // Update visual styling
        const opacity = enabled ? '1' : '0.5';
        startInput.style.opacity = opacity;
        endInput.style.opacity = opacity;
    }
}

// Validate hour input for a specific day
window.validateHourInput = function(day) {
    const enabled = document.getElementById(`${day}_enabled`)?.checked;
    if (!enabled) return;
    
    const startTime = document.getElementById(`${day}_start`)?.value;
    const endTime = document.getElementById(`${day}_end`)?.value;
    
    if (!startTime || !endTime) return;
    
    const startHour = window.timeToHour(startTime);
    const endHour = window.timeToHour(endTime);
    
    const startInput = document.getElementById(`${day}_start`);
    const endInput = document.getElementById(`${day}_end`);
    
    // Reset styles
    if (startInput && endInput) {
        startInput.style.borderColor = '#ddd';
        endInput.style.borderColor = '#ddd';
        
        // Validate time range
        if (endHour <= startHour) {
            endInput.style.borderColor = '#dc3545';
            endInput.title = 'End time must be after start time';
            return false;
        }
        
        // Check for reasonable operating hours
        const duration = endHour - startHour;
        if (duration > 16) {
            startInput.style.borderColor = '#ffc107';
            endInput.style.borderColor = '#ffc107';
            startInput.title = 'Very long operating day (>16 hours)';
            endInput.title = 'Very long operating day (>16 hours)';
        } else if (duration < 2) {
            startInput.style.borderColor = '#ffc107';
            endInput.style.borderColor = '#ffc107';
            startInput.title = 'Very short operating day (<2 hours)';
            endInput.title = 'Very short operating day (<2 hours)';
        } else {
            startInput.title = '';
            endInput.title = '';
        }
    }
    
    return true;
};

// Generate enhanced hours summary with analytics
function generateEnhancedHoursSummary(hoursOfOperation) {
    if (Object.keys(hoursOfOperation).length === 0) {
        return `
            <div style="padding: 1rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                <p><strong>⚠️ No hours of operation set</strong></p>
                <p>Configure operating hours to enable schedule generation.</p>
            </div>
        `;
    }

    const totalHours = calculateTotalOperatingHours(hoursOfOperation);
    const operatingDays = Object.keys(hoursOfOperation).length;
    const avgHoursPerDay = operatingDays > 0 ? (totalHours / operatingDays).toFixed(1) : '0';
    
    let html = `
        <div style="margin-bottom: 1rem;">
            <h5>📊 Operating Hours Analytics</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #007bff;">${totalHours.toFixed(1)}</div>
                    <div style="font-size: 0.9rem;">Total Hours/Week</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #28a745;">${operatingDays}</div>
                    <div style="font-size: 0.9rem;">Operating Days</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #17a2b8;">${avgHoursPerDay}</div>
                    <div style="font-size: 0.9rem;">Avg Hours/Day</div>
                </div>
            </div>
        </div>
        
        <h5>📅 Current Schedule</h5>
        <div style="background: white; border: 1px solid #dee2e6; border-radius: 4px; overflow: hidden;">
    `;
    
    for (const [day, hours] of Object.entries(hoursOfOperation)) {
        if (hours && hours.length > 0) {
            const period = hours[0];
            const startHour = period.start_hour || window.timeToHour(period.start);
            const endHour = period.end_hour || window.timeToHour(period.end);
            const duration = endHour - startHour;
            
            html += `
                <div style="padding: 0.75rem; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${day}:</strong> 
                        ${window.formatTimeAMPM(period.start)} - ${window.formatTimeAMPM(period.end)}
                    </div>
                    <div style="color: #6c757d; font-size: 0.9rem;">
                        ${duration.toFixed(1)} hours
                    </div>
                </div>
            `;
        }
    }
    
    html += '</div>';
    
    // Add scheduling recommendations
    if (totalHours < 15) {
        html += `
            <div style="margin-top: 1rem; padding: 1rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                <p><strong>💡 Scheduling Tip:</strong> With only ${totalHours.toFixed(1)} operating hours per week, 
                you may want to consider extending hours to provide more scheduling flexibility.</p>
            </div>
        `;
    }
    
    return html;
}

// Enhanced save hours with validation
window.saveHours = async function() {
    if (!window.selectedWorkplace) {
        alert('Please select a workplace first.');
        return;
    }

    // Validate all enabled days first
    let hasErrors = false;
    const enabledDays = DAYS.filter(day => {
        const checkbox = document.getElementById(`${day}_enabled`);
        return checkbox && checkbox.checked;
    });
    
    for (const day of enabledDays) {
        if (!validateHourInput(day)) {
            hasErrors = true;
        }
    }
    
    if (hasErrors) {
        alert('⚠️ Please fix the highlighted time issues before saving.');
        return;
    }
    
    if (enabledDays.length === 0) {
        const proceed = confirm('⚠️ No operating days selected. This will prevent schedule generation. Continue anyway?');
        if (!proceed) return;
    }

    try {
        // Ensure workplace document exists
        await window.initializeWorkplace(window.selectedWorkplace);
        
        const hoursOfOperation = {};

        DAYS.forEach(day => {
            const checkbox = document.getElementById(`${day}_enabled`);
            const enabled = checkbox && checkbox.checked;
            
            if (enabled) {
                const startInput = document.getElementById(`${day}_start`);
                const endInput = document.getElementById(`${day}_end`);
                
                if (startInput && endInput) {
                    const start = startInput.value;
                    const end = endInput.value;
                    
                    hoursOfOperation[day] = [{
                        start: start,
                        end: end,
                        start_hour: window.timeToHour(start),
                        end_hour: window.timeToHour(end)
                    }];
                }
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
        
        // Show analytics after save
        const totalHours = calculateTotalOperatingHours(hoursOfOperation);
        console.log(`📊 Workplace now has ${totalHours.toFixed(1)} operating hours per week across ${Object.keys(hoursOfOperation).length} days`);
        
    } catch (error) {
        console.error('❌ Error saving hours:', error);
        alert('❌ Error saving hours: ' + error.message);
    }
};

// Enhanced load hours for scheduling with validation
window.loadHoursForScheduling = async function(workplace) {
    // Ensure workplace document exists
    await window.initializeWorkplace(workplace);
    
    const workplaceRef = doc(workplaceDb, 'workplaces', workplace);
    const workplaceDoc = await getDoc(workplaceRef);
    
    if (workplaceDoc.exists()) {
        const hoursOfOperation = workplaceDoc.data().hours_of_operation || {};
        
        // Validate hours for scheduling
        const totalHours = calculateTotalOperatingHours(hoursOfOperation);
        if (totalHours < 5) {
            console.warn(`⚠️ Very low operating hours for scheduling: ${totalHours.toFixed(1)} hours/week`);
        }
        
        return hoursOfOperation;
    }
    return {};
};

// Check if hours of operation are compatible with scheduling requirements
window.validateHoursForScheduling = function(hoursOfOperation, workers = []) {
    const issues = [];
    const totalHours = calculateTotalOperatingHours(hoursOfOperation);
    
    if (totalHours < 10) {
        issues.push(`Low operating hours: ${totalHours.toFixed(1)} hours/week may limit scheduling options`);
    }
    
    if (Object.keys(hoursOfOperation).length < 2) {
        issues.push('Operating on fewer than 2 days per week may limit worker scheduling');
    }
    
    // Check if any work study students can get their required 5 hours
    const workStudyWorkers = workers.filter(w => w.work_study);
    for (const worker of workStudyWorkers) {
        let maxPossibleHours = 0;
        
        for (const [day, dayHours] of Object.entries(hoursOfOperation)) {
            for (const period of dayHours) {
                const periodStart = period.start_hour || window.timeToHour(period.start);
                const periodEnd = period.end_hour || window.timeToHour(period.end);
                
                if (worker.availability && worker.availability[day]) {
                    for (const avail of worker.availability[day]) {
                        const overlapStart = Math.max(periodStart, avail.start_hour);
                        const overlapEnd = Math.min(periodEnd, avail.end_hour);
                        if (overlapEnd > overlapStart) {
                            maxPossibleHours += (overlapEnd - overlapStart);
                        }
                    }
                }
            }
        }
        
        if (maxPossibleHours < 5) {
            issues.push(`Work study student ${worker.first_name} ${worker.last_name} can only get ${maxPossibleHours.toFixed(1)} hours (needs 5)`);
        }
    }
    
    return {
        valid: issues.length === 0,
        issues,
        totalHours,
        operatingDays: Object.keys(hoursOfOperation).length
    };
};

// Export functions
export { 
    displayHours, 
    generateEnhancedHoursSummary, 
    calculateTotalOperatingHours,
    validateHoursForScheduling 
};