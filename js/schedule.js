// Schedule generation and management
import { collection, getDocs, doc, updateDoc, getDoc, addDoc, query, orderBy, limit, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb, DAYS } from './firebase-config.js';

// Global variables
window.currentSchedule = null;
window.draftSchedule = null;
window.currentShiftOverrides = {};
window.selectedScheduleId = null;

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Schedule option buttons
    const generateScheduleOption = document.getElementById('generateScheduleOption');
    if (generateScheduleOption) {
        generateScheduleOption.addEventListener('click', showGenerateScheduleForm);
    }
    
    const viewCurrentScheduleOption = document.getElementById('viewCurrentScheduleOption');
    if (viewCurrentScheduleOption) {
        viewCurrentScheduleOption.addEventListener('click', viewCurrentSchedule);
    }
    
    const shiftOverrideOption = document.getElementById('shiftOverrideOption');
    if (shiftOverrideOption) {
        shiftOverrideOption.addEventListener('click', openShiftOverride);
    }
    
    const scheduleHistoryOption = document.getElementById('scheduleHistoryOption');
    if (scheduleHistoryOption) {
        scheduleHistoryOption.addEventListener('click', viewScheduleHistory);
    }
    
    // Generate schedule buttons
    const generateScheduleBtn = document.getElementById('generateScheduleBtn');
    if (generateScheduleBtn) {
        generateScheduleBtn.addEventListener('click', generateSchedule);
    }
    
    const cancelGenerateBtn = document.getElementById('cancelGenerateBtn');
    if (cancelGenerateBtn) {
        cancelGenerateBtn.addEventListener('click', hideGenerateScheduleForm);
    }
    
    // Shift override buttons
    const saveOverridesBtn = document.getElementById('saveOverridesBtn');
    if (saveOverridesBtn) {
        saveOverridesBtn.addEventListener('click', saveShiftOverrides);
    }
    
    const cancelOverrideBtn = document.getElementById('cancelOverrideBtn');
    if (cancelOverrideBtn) {
        cancelOverrideBtn.addEventListener('click', hideShiftOverride);
    }
    
    // Schedule history buttons
    const backToScheduleBtn = document.getElementById('backToScheduleBtn');
    if (backToScheduleBtn) {
        backToScheduleBtn.addEventListener('click', hideScheduleHistory);
    }
});

// Show generate schedule form
window.showGenerateScheduleForm = function() {
    document.getElementById('generateScheduleForm').style.display = 'block';
    document.getElementById('shiftOverrideSection').style.display = 'none';
    document.getElementById('scheduleHistorySection').style.display = 'none';
    document.getElementById('scheduleContent').innerHTML = '<p>Configure your schedule settings above.</p>';
};

// Hide generate schedule form
window.hideGenerateScheduleForm = function() {
    document.getElementById('generateScheduleForm').style.display = 'none';
    document.getElementById('scheduleContent').innerHTML = '<p>Select an option above to get started.</p>';
};

// Show schedule history
window.viewScheduleHistory = async function() {
    document.getElementById('generateScheduleForm').style.display = 'none';
    document.getElementById('shiftOverrideSection').style.display = 'none';
    document.getElementById('scheduleHistorySection').style.display = 'block';
    document.getElementById('scheduleContent').innerHTML = '';
    
    try {
        // Get all schedules for this workplace
        const schedulesRef = collection(workplaceDb, 'workplaces', window.selectedWorkplace, 'schedules');
        const q = query(schedulesRef, orderBy('created_at', 'desc'));
        const querySnapshot = await getDocs(q);
        
        // Get current schedule ID
        const workplaceRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace);
        const workplaceDoc = await getDoc(workplaceRef);
        const currentScheduleId = workplaceDoc.exists() ? workplaceDoc.data().current_schedule_id : null;
        
        // Display schedules
        const historyList = document.getElementById('scheduleHistoryList');
        
        if (querySnapshot.empty) {
            historyList.innerHTML = '<div style="padding: 1rem; text-align: center;">No schedules found.</div>';
            return;
        }
        
        let historyHtml = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = new Date(data.created_at);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            const isCurrent = doc.id === currentScheduleId;
            
            historyHtml += `
                <div class="schedule-list-item ${isCurrent ? 'current' : ''}" onclick="viewScheduleById('${doc.id}')">
                    <div>
                        <div class="schedule-date">${data.name || 'Schedule'}</div>
                        <div>Created: ${formattedDate}</div>
                        ${isCurrent ? '<div style="color: #28a745; font-weight: bold;">Current Active Schedule</div>' : ''}
                    </div>
                    <div class="schedule-actions">
                        <button class="history-btn" onclick="viewScheduleById('${doc.id}'); event.stopPropagation();">View</button>
                        ${!isCurrent ? `<button class="history-btn" onclick="publishSchedule('${doc.id}'); event.stopPropagation();">Publish</button>` : ''}
                        <button class="history-btn" onclick="deleteSchedule('${doc.id}'); event.stopPropagation();" style="background: #dc3545;">Delete</button>
                    </div>
                </div>
            `;
        });
        
        historyList.innerHTML = historyHtml;
        
    } catch (error) {
        console.error('❌ Error loading schedule history:', error);
        document.getElementById('scheduleHistoryList').innerHTML = 
            `<div style="padding: 1rem; color: #dc3545;">Error loading schedule history: ${error.message}</div>`;
    }
};

// Hide schedule history
window.hideScheduleHistory = function() {
    document.getElementById('scheduleHistorySection').style.display = 'none';
    document.getElementById('scheduleContent').innerHTML = '<p>Select an option above to get started.</p>';
};

// View schedule by ID
window.viewScheduleById = async function(scheduleId) {
    try {
        window.selectedScheduleId = scheduleId;
        
        const scheduleRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace, 'schedules', scheduleId);
        const scheduleDoc = await getDoc(scheduleRef);
        
        if (scheduleDoc.exists()) {
            const data = scheduleDoc.data();
            
            // Get workplace for current schedule info
            const workplaceRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace);
            const workplaceDoc = await getDoc(workplaceRef);
            const currentScheduleId = workplaceDoc.exists() ? workplaceDoc.data().current_schedule_id : null;
            
            // Set as current schedule if it's the currently published one
            if (scheduleId === currentScheduleId) {
                window.currentSchedule = data.days;
            }
            
            // Set as draft if not current
            if (scheduleId !== currentScheduleId) {
                window.draftSchedule = data.days;
            }
            
            // Hide the history section
            document.getElementById('scheduleHistorySection').style.display = 'none';
            
            // Display the schedule
            const isCurrentSchedule = scheduleId === currentScheduleId;
            displayScheduleWithPublishOption(data.days, isCurrentSchedule, scheduleId);
        } else {
            alert('Schedule not found.');
        }
    } catch (error) {
        console.error('❌ Error viewing schedule:', error);
        alert('❌ Error viewing schedule: ' + error.message);
    }
};

// Publish a schedule as the current one
window.publishSchedule = async function(scheduleId) {
    if (confirm('Are you sure you want to publish this schedule as the current active schedule?')) {
        try {
            // Update the workplace document with the new current schedule ID
            const workplaceRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace);
            await updateDoc(workplaceRef, {
                current_schedule_id: scheduleId,
                updated_at: new Date().toISOString()
            });
            
            // Get the schedule data
            const scheduleRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace, 'schedules', scheduleId);
            const scheduleDoc = await getDoc(scheduleRef);
            
            if (scheduleDoc.exists()) {
                const data = scheduleDoc.data();
                window.currentSchedule = data.days;
                window.draftSchedule = null;
            }
            
            alert('✅ Schedule published successfully!');
            
            // Refresh the history view
            viewScheduleHistory();
        } catch (error) {
            console.error('❌ Error publishing schedule:', error);
            alert('❌ Error publishing schedule: ' + error.message);
        }
    }
};

// Delete a schedule
window.deleteSchedule = async function(scheduleId) {
    try {
        // Get workplace to check if this is the current schedule
        const workplaceRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace);
        const workplaceDoc = await getDoc(workplaceRef);
        const currentScheduleId = workplaceDoc.exists() ? workplaceDoc.data().current_schedule_id : null;
        
        // Don't allow deleting the current schedule
        if (scheduleId === currentScheduleId) {
            alert('Cannot delete the current active schedule. Please publish another schedule first.');
            return;
        }
        
        if (confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
            // Delete the schedule
            await deleteDoc(doc(workplaceDb, 'workplaces', window.selectedWorkplace, 'schedules', scheduleId));
            
            alert('✅ Schedule deleted successfully!');
            
            // Reset selected schedule if this was the one being viewed
            if (window.selectedScheduleId === scheduleId) {
                window.selectedScheduleId = null;
                window.draftSchedule = null;
            }
            
            // Refresh the history view
            viewScheduleHistory();
        }
    } catch (error) {
        console.error('❌ Error deleting schedule:', error);
        alert('❌ Error deleting schedule: ' + error.message);
    }
};

// Open shift override
window.openShiftOverride = async function() {
    document.getElementById('generateScheduleForm').style.display = 'none';
    document.getElementById('shiftOverrideSection').style.display = 'block';
    document.getElementById('scheduleHistorySection').style.display = 'none';
    
    // First check if we have a current schedule to override
    if (!window.currentSchedule) {
        try {
            await loadCurrentSchedule();
        } catch (error) {
            console.error('❌ Error loading current schedule:', error);
            document.getElementById('shiftOverrideContent').innerHTML = `
                <p>Error loading current schedule. Please generate or view a schedule first.</p>
            `;
            return;
        }
    }
    
    if (!window.currentSchedule) {
        document.getElementById('shiftOverrideContent').innerHTML = `
            <p>No current schedule found. Please generate a schedule first.</p>
        `;
        return;
    }
    
    // Initialize the shift override content
    initializeShiftOverride();
};

// Hide shift override
window.hideShiftOverride = function() {
    document.getElementById('shiftOverrideSection').style.display = 'none';
    document.getElementById('scheduleContent').innerHTML = '<p>Select an option above to get started.</p>';
};

// Initialize shift override interface
function initializeShiftOverride() {
    let html = `<h5>Modify Shift Assignments</h5>`;
    
    // Create a section for each day
    for (const day of DAYS) {
        const shifts = window.currentSchedule[day] || [];
        if (shifts.length === 0) continue;
        
        html += `<div class="schedule-day-header">${day}</div>`;
        
        // Display each shift with editable worker assignments
        shifts.forEach((shift, index) => {
            const shiftKey = `${day}_${index}`;
            const isUnfilled = shift.assigned && shift.assigned.includes('Unfilled');
            
            html += `
                <div class="override-shift-row">
                    <div><strong>${window.formatTimeAMPM(shift.start)} - ${window.formatTimeAMPM(shift.end)}</strong></div>
                    <div style="flex: 1;">
                        <div>Currently assigned: <span class="${isUnfilled ? 'unfilled-text' : ''}">${shift.assigned ? shift.assigned.join(', ') : 'None'}</span></div>
                        <div class="override-worker-list" id="override_${shiftKey}">
                            <!-- Workers will be listed here -->
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    document.getElementById('shiftOverrideContent').innerHTML = html;
    
    // Populate available workers for each shift
    populateShiftOverrideWorkers();
}

// Populate available workers for shift override
function populateShiftOverrideWorkers() {
    // Reset the shift overrides
    window.currentShiftOverrides = {};
    
    // For each day and shift
    for (const day of DAYS) {
        const shifts = window.currentSchedule[day] || [];
        
        shifts.forEach((shift, index) => {
            const shiftKey = `${day}_${index}`;
            const container = document.getElementById(`override_${shiftKey}`);
            if (!container) return;
            
            // Get currently assigned workers
            const assignedEmails = shift.raw_assigned || [];
            
            // Create worker selection elements
            let workerHtml = '';
            
            // First add all available workers
            if (shift.all_available && shift.all_available.length > 0) {
                shift.all_available.forEach(worker => {
                    const isAssigned = assignedEmails.includes(worker.email);
                    workerHtml += `
                        <div class="override-worker-item ${isAssigned ? 'selected' : ''}" 
                             data-email="${worker.email}" 
                             data-selected="${isAssigned}"
                             onclick="toggleWorkerSelection('${shiftKey}', '${worker.email}')">
                            ${worker.first_name} ${worker.last_name}
                        </div>
                    `;
                });
            } else {
                // If no available workers, check all workers
                window.workers.forEach(worker => {
                    const isAssigned = assignedEmails.includes(worker.email);
                    workerHtml += `
                        <div class="override-worker-item ${isAssigned ? 'selected' : ''}" 
                             data-email="${worker.email}" 
                             data-selected="${isAssigned}"
                             onclick="toggleWorkerSelection('${shiftKey}', '${worker.email}')">
                            ${worker.first_name} ${worker.last_name}
                        </div>
                    `;
                });
            }
            
            container.innerHTML = workerHtml;
        });
    }
}

// Toggle worker selection in shift override
window.toggleWorkerSelection = function(shiftKey, email) {
    const element = document.querySelector(`.override-worker-item[data-email="${email}"][onclick*="${shiftKey}"]`);
    if (!element) return;
    
    const isSelected = element.classList.contains('selected');
    
    // Toggle selection
    if (isSelected) {
        element.classList.remove('selected');
        element.setAttribute('data-selected', 'false');
    } else {
        element.classList.add('selected');
        element.setAttribute('data-selected', 'true');
    }
    
    // Store the change in currentShiftOverrides
    if (!window.currentShiftOverrides[shiftKey]) {
        window.currentShiftOverrides[shiftKey] = {
            added: [],
            removed: []
        };
    }
    
    if (isSelected) {
        // Worker was selected and is now deselected, add to removed list
        if (!window.currentShiftOverrides[shiftKey].removed.includes(email)) {
            window.currentShiftOverrides[shiftKey].removed.push(email);
        }
        // Remove from added list if present
        const addedIndex = window.currentShiftOverrides[shiftKey].added.indexOf(email);
        if (addedIndex > -1) {
            window.currentShiftOverrides[shiftKey].added.splice(addedIndex, 1);
        }
    } else {
        // Worker was not selected and is now selected, add to added list
        if (!window.currentShiftOverrides[shiftKey].added.includes(email)) {
            window.currentShiftOverrides[shiftKey].added.push(email);
        }
        // Remove from removed list if present
        const removedIndex = window.currentShiftOverrides[shiftKey].removed.indexOf(email);
        if (removedIndex > -1) {
            window.currentShiftOverrides[shiftKey].removed.splice(removedIndex, 1);
        }
    }
};

// Save shift overrides
window.saveShiftOverrides = async function() {
    if (!window.currentSchedule || !window.selectedWorkplace) {
        alert('No schedule to save changes to.');
        return;
    }
    
    try {
        // Make a deep copy of the current schedule
        const updatedSchedule = JSON.parse(JSON.stringify(window.currentSchedule));
        
        // Apply the overrides to the updated schedule
        for (const [shiftKey, changes] of Object.entries(window.currentShiftOverrides)) {
            const [day, indexStr] = shiftKey.split('_');
            const index = parseInt(indexStr);
            
            if (updatedSchedule[day] && updatedSchedule[day][index]) {
                const shift = updatedSchedule[day][index];
                
                // Process removals
                changes.removed.forEach(email => {
                    const rawIndex = shift.raw_assigned ? shift.raw_assigned.indexOf(email) : -1;
                    if (rawIndex > -1) {
                        shift.raw_assigned.splice(rawIndex, 1);
                        
                        // Find and remove the corresponding name
                        const worker = window.workers.find(w => w.email === email);
                        if (worker) {
                            const name = `${worker.first_name} ${worker.last_name}`;
                            const nameIndex = shift.assigned.indexOf(name);
                            if (nameIndex > -1) {
                                shift.assigned.splice(nameIndex, 1);
                            }
                        }
                    }
                });
                
                // Process additions
                changes.added.forEach(email => {
                    if (!shift.raw_assigned) {
                        shift.raw_assigned = [];
                    }
                    
                    if (!shift.raw_assigned.includes(email)) {
                        shift.raw_assigned.push(email);
                        
                        // Add the corresponding name
                        const worker = window.workers.find(w => w.email === email);
                        if (worker) {
                            const name = `${worker.first_name} ${worker.last_name}`;
                            if (!shift.assigned) {
                                shift.assigned = [];
                            }
                            shift.assigned.push(name);
                        }
                    }
                });
                
                // If no workers assigned, mark as Unfilled
                if (!shift.raw_assigned || shift.raw_assigned.length === 0) {
                    shift.assigned = ['Unfilled'];
                    if (!shift.raw_assigned) shift.raw_assigned = [];
                } else if (shift.assigned && shift.assigned.includes('Unfilled')) {
                    // Remove 'Unfilled' if workers are assigned
                    const unfilledIndex = shift.assigned.indexOf('Unfilled');
                    if (unfilledIndex > -1) {
                        shift.assigned.splice(unfilledIndex, 1);
                    }
                }
            }
        }
        
        // Save as a new schedule and set as draft (not published yet)
        const scheduleId = await saveScheduleToFirebase(updatedSchedule, false);
        window.draftSchedule = updatedSchedule;
        
        alert('✅ Schedule changes saved successfully! You can now publish this schedule to make it active.');
        
        // Hide the shift override section
        document.getElementById('shiftOverrideSection').style.display = 'none';
        
        // Display the schedule with publish option
        displayScheduleWithPublishOption(updatedSchedule, false, scheduleId);
        
    } catch (error) {
        console.error('❌ Error saving shift overrides:', error);
        alert('❌ Error saving shift overrides: ' + error.message);
    }
};

// Save schedule to Firebase
async function saveScheduleToFirebase(schedule, setAsCurrent = false) {
    try {
        // Ensure workplace document exists
        await window.initializeWorkplace(window.selectedWorkplace);
        
        // Create a formatted schedule for Firebase
        const scheduleData = {
            days: schedule,
            created_at: new Date().toISOString(),
            workplace_id: window.selectedWorkplace,
            name: `${window.selectedWorkplace.replace('_', ' ').toUpperCase()} Schedule ${new Date().toLocaleDateString()}`
        };
        
        // Save to Firebase - first to schedules collection
        const schedulesRef = collection(workplaceDb, 'workplaces', window.selectedWorkplace, 'schedules');
        const docRef = await addDoc(schedulesRef, scheduleData);
        console.log(`Schedule saved with ID: ${docRef.id}`);
        
        // Update the workplace document with current schedule ID if requested
        if (setAsCurrent) {
            const workplaceRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace);
            await updateDoc(workplaceRef, {
                current_schedule_id: docRef.id,
                updated_at: new Date().toISOString()
            });
            window.currentSchedule = schedule;
        }
        
        return docRef.id;
    } catch (error) {
        console.error('❌ Error saving schedule to Firebase:', error);
        throw error;
    }
}

// Get current schedule from Firebase
async function loadCurrentSchedule() {
    try {
        // Ensure workplace document exists
        await window.initializeWorkplace(window.selectedWorkplace);
        
        const workplaceRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace);
        const workplaceDoc = await getDoc(workplaceRef);
        
        if (workplaceDoc.exists()) {
            const data = workplaceDoc.data();
            const currentScheduleId = data.current_schedule_id;
            
            if (currentScheduleId) {
                // Get schedule from the schedules subcollection
                const scheduleRef = doc(workplaceDb, 'workplaces', window.selectedWorkplace, 'schedules', currentScheduleId);
                const scheduleDoc = await getDoc(scheduleRef);
                
                if (scheduleDoc.exists()) {
                    const data = scheduleDoc.data();
                    // The schedule might be directly in the document or in a 'days' field
                    if (data.days) {
                        window.currentSchedule = data.days;
                        return data.days;
                    } else {
                        window.currentSchedule = data;
                        return data;
                    }
                }
            }
        }
        
        // If no current schedule ID or document not found, look for the most recent
        const schedulesRef = collection(workplaceDb, 'workplaces', window.selectedWorkplace, 'schedules');
        const querySnapshot = await getDocs(query(schedulesRef, orderBy('created_at', 'desc'), limit(1)));
        
        if (!querySnapshot.empty) {
            const scheduleDoc = querySnapshot.docs[0];
            const data = scheduleDoc.data();
            
            // The schedule might be directly in the document or in a 'days' field
            if (data.days) {
                window.currentSchedule = data.days;
                return data.days;
            } else {
                window.currentSchedule = data;
                return data;
            }
        }
        
        // No schedule found
        window.currentSchedule = null;
        return null;
    } catch (error) {
        console.error('❌ Error loading current schedule:', error);
        throw error;
    }
}

// View current schedule
window.viewCurrentSchedule = async function() {
    if (!window.selectedWorkplace) {
        alert('Please select a workplace first.');
        return;
    }
    
    document.getElementById('scheduleContent').innerHTML = `
        <div class="loading">Loading current schedule...</div>
    `;
    document.getElementById('generateScheduleForm').style.display = 'none';
    document.getElementById('shiftOverrideSection').style.display = 'none';
    document.getElementById('scheduleHistorySection').style.display = 'none';
    
    try {
        const schedule = await loadCurrentSchedule();
        
        if (schedule) {
            // Display the schedule with current marker
            displayScheduleWithPublishOption(schedule, true);
        } else {
            document.getElementById('scheduleContent').innerHTML = `
                <p>No current schedule found. Please generate a new schedule first.</p>
            `;
        }
    } catch (error) {
        console.error('❌ Error viewing current schedule:', error);
        document.getElementById('scheduleContent').innerHTML = `
            <h4>❌ Error Loading Schedule</h4>
            <p>Error: ${error.message}</p>
        `;
    }
};

// Calculate assigned hours per worker
function calculateAssignedHours(schedule) {
    const assignedHours = {};
    
    for (const [day, shifts] of Object.entries(schedule)) {
        for (const shift of shifts) {
            const startHour = window.timeToHour(shift.start);
            const endHour = window.timeToHour(shift.end);
            const duration = endHour - startHour;
            
            const workers = shift.raw_assigned || [];
            workers.forEach(email => {
                assignedHours[email] = (assignedHours[email] || 0) + duration;
            });
        }
    }
    
    return assignedHours;
}

// Display schedule with publish option
function displayScheduleWithPublishOption(schedule, isCurrent = false, scheduleId = null) {
    if (!schedule) return;
    
    const assignedHours = calculateAssignedHours(schedule);
    
    // Calculate some statistics
    const totalShifts = Object.values(schedule).flat().length;
    const unfilledShifts = Object.values(schedule).flat().filter(shift => 
        shift.assigned && shift.assigned.includes('Unfilled')).length;
    const assignedWorkers = Object.keys(assignedHours).length;
    
    let html = '';
    
    // Add current schedule banner or publish button
    if (isCurrent) {
        html += `
            <div class="publish-banner">
                <strong>✅ This is the current active schedule</strong>
            </div>
        `;
    } else if (scheduleId) {
        html += `
            <button class="publish-btn" onclick="publishSchedule('${scheduleId}')">
                📢 Publish as Current Schedule
            </button>
            <p style="margin-bottom: 1rem; font-style: italic;">This is a draft schedule. Click the button above to publish it as the current active schedule.</p>
        `;
    }
    
    html += `
        <div class="stats" style="margin-bottom: 2rem;">
            <div class="stat-card">
                <div class="stat-number">${totalShifts}</div>
                <div class="stat-label">Total Shifts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${unfilledShifts}</div>
                <div class="stat-label">Unfilled Shifts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${assignedWorkers}</div>
                <div class="stat-label">Workers Assigned</div>
            </div>
        </div>
    `;
    
    // Check for work study issues
    const workStudyIssues = checkWorkStudyIssues(assignedHours);
    if (workStudyIssues.length > 0) {
        html += `<div class="schedule-warning">
            <h5>⚠️ Work Study Issues</h5>
            <p>The following work study students do not have exactly 5 hours:</p>
            <ul>`;
        
        workStudyIssues.forEach(issue => {
            html += `<li class="work-study-issue">${issue}</li>`;
        });
        
        html += `</ul></div>`;
    }
    
    // Display schedule by day
    for (const day of DAYS) {
        const shifts = schedule[day] || [];
        if (shifts.length === 0) continue;
        
        html += `<div class="schedule-day-header">${day}</div>`;
        
        shifts.forEach(shift => {
            const isUnfilled = shift.assigned && shift.assigned.includes('Unfilled');
            html += `
                <div class="schedule-shift ${isUnfilled ? 'unfilled' : ''}">
                    <div class="schedule-time">${window.formatTimeAMPM(shift.start)} - ${window.formatTimeAMPM(shift.end)}</div>
                    <div class="schedule-workers">
                        ${isUnfilled ? '<span class="unfilled-text">Unfilled</span>' : shift.assigned.join(', ')}
                    </div>
                </div>
            `;
        });
    }
    
    // Worker hours summary
    html += `<h5 style="margin-top: 2rem;">Worker Hours Summary</h5>`;
    html += `<table class="user-table">
        <thead>
            <tr>
                <th>Worker</th>
                <th>Hours</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>`;
    
    // Sort workers by hours (descending)
    const sortedWorkers = Object.entries(assignedHours).sort((a, b) => b[1] - a[1]);
    
    sortedWorkers.forEach(([email, hours]) => {
        const worker = window.workers.find(w => w.email === email);
        if (!worker) return;
        
        const name = `${worker.first_name} ${worker.last_name}`;
        const isWorkStudy = worker.work_study === true || worker.work_study === 'Yes';
        
        let status = '';
        let statusClass = '';
        
        if (isWorkStudy && hours !== 5) {
            status = 'Work Study Hours Issue';
            statusClass = 'unfilled-text';
        } else if (hours < 3) {
            status = 'Low Hours';
            statusClass = 'unfilled-text';
        } else {
            status = 'OK';
        }
        
        html += `
            <tr>
                <td>${name} ${isWorkStudy ? '<small>(Work Study)</small>' : ''}</td>
                <td>${hours.toFixed(1)}</td>
                <td class="${statusClass}">${status}</td>
            </tr>
        `;
    });
    
    // Add workers with 0 hours
    const assignedEmails = Object.keys(assignedHours);
    const unassignedWorkers = window.workers.filter(w => !assignedEmails.includes(w.email));
    
    unassignedWorkers.forEach(worker => {
        const name = `${worker.first_name} ${worker.last_name}`;
        const isWorkStudy = worker.work_study === true || worker.work_study === 'Yes';
        
        html += `
            <tr>
                <td>${name} ${isWorkStudy ? '<small>(Work Study)</small>' : ''}</td>
                <td>0.0</td>
                <td class="unfilled-text">Unassigned</td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    
    // Add export and print options
    html += `
        <div class="print-options">
            <h5>Export Options</h5>
            <button onclick="printSchedule()" class="history-btn">
                🖨️ Print Schedule
            </button>
            <button onclick="exportScheduleToExcel()" class="history-btn" style="background: #28a745;">
                📊 Export to Excel
            </button>
            <button onclick="emailSchedule()" class="history-btn" style="background: #007bff;">
                📧 Email Schedule
            </button>
        </div>
    `;
    
    document.getElementById('scheduleContent').innerHTML = html;
}

// Check for work study issues
function checkWorkStudyIssues(assignedHours) {
    const issues = [];
    
    window.workers.forEach(worker => {
        if (worker.work_study === true || worker.work_study === 'Yes') {
            const hours = assignedHours[worker.email] || 0;
            if (hours !== 5) {
                issues.push(`${worker.first_name} ${worker.last_name} (${hours.toFixed(1)} hours instead of 5)`);
            }
        }
    });
    
    return issues;
}

// Print schedule
window.printSchedule = function() {
    // Determine which schedule to print
    const scheduleToPrint = window.draftSchedule || window.currentSchedule;
    
    if (!scheduleToPrint) {
        alert('No schedule to print.');
        return;
    }
    
    // Create a printable version of the schedule
    const printWindow = window.open('', '_blank');
    
    // Create the HTML content for printing
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${window.selectedWorkplace.replace('_', ' ')} Schedule</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }
                h1 {
                    text-align: center;
                    color: #007bff;
                }
                .day-header {
                    font-size: 18px;
                    font-weight: bold;
                    margin-top: 20px;
                    padding-bottom: 5px;
                    border-bottom: 1px solid #ddd;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th {
                    background-color: #f8f9fa;
                    padding: 8px;
                    text-align: left;
                    border-bottom: 2px solid #ddd;
                }
                td {
                    padding: 8px;
                    border-bottom: 1px solid #ddd;
                }
                .unfilled {
                    color: #dc3545;
                    font-weight: bold;
                }
                .summary-table {
                    margin-top: 30px;
                }
                @media print {
                    body {
                        margin: 0;
                        padding: 15px;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <h1>${window.selectedWorkplace.replace('_', ' ').toUpperCase()} Schedule</h1>
            <p style="text-align: center;">Generated on ${new Date().toLocaleDateString()}</p>
            
            <button class="no-print" onclick="window.print()" style="display: block; margin: 20px auto; padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Print Schedule
            </button>
    `;
    
    // Add schedule by day
    for (const day of DAYS) {
        const shifts = scheduleToPrint[day] || [];
        if (shifts.length === 0) continue;
        
        printContent += `<div class="day-header">${day}</div>`;
        printContent += `<table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Assigned Workers</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        shifts.forEach(shift => {
            const isUnfilled = shift.assigned && shift.assigned.includes('Unfilled');
            printContent += `
                <tr>
                    <td>${window.formatTimeAMPM(shift.start)} - ${window.formatTimeAMPM(shift.end)}</td>
                    <td class="${isUnfilled ? 'unfilled' : ''}">
                        ${shift.assigned ? shift.assigned.join(', ') : 'Unassigned'}
                    </td>
                </tr>
            `;
        });
        
        printContent += `</tbody></table>`;
    }
    
    // Calculate hours per worker
    const assignedHours = calculateAssignedHours(scheduleToPrint);
    
    // Add worker hours summary
    printContent += `
        <h2>Worker Hours Summary</h2>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Worker</th>
                    <th>Hours</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Sort workers by hours (descending)
    const sortedWorkers = Object.entries(assignedHours).sort((a, b) => b[1] - a[1]);
    
    sortedWorkers.forEach(([email, hours]) => {
        const worker = window.workers.find(w => w.email === email);
        if (!worker) return;
        
        const name = `${worker.first_name} ${worker.last_name}`;
        printContent += `
            <tr>
                <td>${name}</td>
                <td>${hours.toFixed(1)}</td>
            </tr>
        `;
    });
    
    printContent += `</tbody></table>`;
    
    // Close the HTML
    printContent += `</body></html>`;
    
    // Write to the new window and trigger print
    printWindow.document.write(printContent);
    printWindow.document.close();
};

// Export schedule to Excel
window.exportScheduleToExcel = function() {
    if (!window.currentSchedule && !window.draftSchedule) {
        alert('No schedule to export.');
        return;
    }
    
    alert('Export to Excel functionality requires server-side processing.\n\nThis feature will be implemented in a future update.');
};

// Email schedule
window.emailSchedule = function() {
    if (!window.currentSchedule && !window.draftSchedule) {
        alert('No schedule to email.');
        return;
    }
    
    alert('Email schedule functionality requires server-side processing.\n\nThis feature will be implemented in a future update.');
};

// Generate new schedule
window.generateSchedule = async function() {
    if (!window.selectedWorkplace) {
        alert('Please select a workplace first.');
        return;
    }
    
    document.getElementById('scheduleContent').innerHTML = `
        <div class="loading">🔄 Generating schedule for ${window.selectedWorkplace}...</div>
    `;
    
    try {
        // Get schedule settings from form
        const maxHoursPerWorker = parseInt(document.getElementById('maxHoursPerWorker').value) || 20;
        const maxWorkersPerShift = parseInt(document.getElementById('maxWorkersPerShift').value) || 2;
        const minHoursPerWorker = parseInt(document.getElementById('minHoursPerWorker').value) || 3;
        
        // Load workers and hours data
        const [workersData, hoursData] = await Promise.all([
            window.loadWorkersForScheduling(window.selectedWorkplace),
            window.loadHoursForScheduling(window.selectedWorkplace)
        ]);
        
        console.log('📊 Generating schedule with:', { 
            workers: workersData.length, 
            hoursData,
            maxHoursPerWorker,
            maxWorkersPerShift,
            minHoursPerWorker
        });
        
        // Check if we have all necessary data
        if (workersData.length === 0) {
            document.getElementById('scheduleContent').innerHTML = `
                <div class="schedule-warning">
                    <h5>⚠️ No Workers Available</h5>
                    <p>Add workers to the workplace before generating a schedule.</p>
                </div>
            `;
            return;
        }
        
        if (Object.keys(hoursData).length === 0) {
            document.getElementById('scheduleContent').innerHTML = `
                <div class="schedule-warning">
                    <h5>⚠️ No Hours of Operation</h5>
                    <p>Set hours of operation for the workplace before generating a schedule.</p>
                </div>
            `;
            return;
        }
        
        // Generate the schedule
        const scheduleResult = await createScheduleFromAvailability(
            hoursData, 
            workersData, 
            window.selectedWorkplace,
            maxHoursPerWorker,
            maxWorkersPerShift,
            minHoursPerWorker
        );
        
        // Save the generated schedule to Firebase as a draft (not published)
        const scheduleId = await saveScheduleToFirebase(scheduleResult.schedule, false);
        window.draftSchedule = scheduleResult.schedule;
        
        // Hide the generation form
        document.getElementById('generateScheduleForm').style.display = 'none';
        
        // Display the schedule with publish option
        displayScheduleWithPublishOption(scheduleResult.schedule, false, scheduleId);
        
    } catch (error) {
        console.error('❌ Error generating schedule:', error);
        document.getElementById('scheduleContent').innerHTML = `
            <div class="schedule-warning">
                <h5>❌ Error Generating Schedule</h5>
                <p>Error: ${error.message}</p>
            </div>
        `;
    }
};

// Create schedule from availability (JavaScript implementation of Python algorithm)
async function createScheduleFromAvailability(hoursOfOperation, workersData, workplace, maxHoursPerWorker, maxWorkersPerShift, minHoursPerWorker) {
    const schedule = {};
    const assignedHours = {};
    const unfilledShifts = [];
    const alternativeSolutions = {};
    const wsIssues = [];
    
    // Initialize worker hours
    workersData.forEach(w => {
        assignedHours[w.email] = 0;
    });
    
    // 1. First pass: Assign work study students exactly 5 hours
    const workStudyWorkers = workersData.filter(w => w.work_study);
    
    // Special handling for work study students
    for (const worker of workStudyWorkers) {
        // Find all available slots for this work study student
        const availableSlots = [];
        
        for (const [day, dayHours] of Object.entries(hoursOfOperation)) {
            if (!dayHours || dayHours.length === 0) continue;
            
            for (const hours of dayHours) {
                const startHour = hours.start_hour;
                const endHour = hours.end_hour;
                
                // Check if worker is available during this time
                if (window.isWorkerAvailableDuringHours(worker, day, startHour, endHour)) {
                    availableSlots.push({
                        day,
                        start: startHour,
                        end: endHour,
                        duration: endHour - startHour
                    });
                }
            }
        }
        
        // Sort slots by duration (ascending) for better fitting
        availableSlots.sort((a, b) => a.duration - b.duration);
        
        // Try to find an optimal 5-hour schedule
        const optimalSlots = findOptimalWorkStudySchedule(availableSlots, 5);
        
        if (optimalSlots.totalHours === 5) {
            // Assign the slots to the worker
            for (const slot of optimalSlots.slots) {
                const { day, start, end, duration } = slot;
                
                // Create the shift
                const shift = {
                    start: window.hourToTimeStr(start),
                    end: window.hourToTimeStr(end),
                    assigned: [`${worker.first_name} ${worker.last_name}`],
                    raw_assigned: [worker.email],
                    available: [`${worker.first_name} ${worker.last_name}`],
                    all_available: [worker],
                    is_work_study: true
                };
                
                // Add to schedule
                if (!schedule[day]) schedule[day] = [];
                schedule[day].push(shift);
                
                // Update assigned hours
                assignedHours[worker.email] = (assignedHours[worker.email] || 0) + duration;
            }
        } else {
            // Couldn't find an optimal 5-hour schedule
            wsIssues.push(`${worker.first_name} ${worker.last_name}: Could not schedule exactly 5 hours (available ${optimalSlots.totalHours.toFixed(1)} hours)`);
        }
    }
    
    // 2. Second pass: Fill remaining hours with regular workers
    for (const [day, dayHours] of Object.entries(hoursOfOperation)) {
        if (!dayHours || dayHours.length === 0) continue;
        
        // Initialize day in schedule if needed
        if (!schedule[day]) schedule[day] = [];
        
        for (const hours of dayHours) {
            const startHour = hours.start_hour;
            const endHour = hours.end_hour;
            
            // Create 2-4 hour shifts within this time block
            let currentHour = startHour;
            while (currentHour < endHour) {
                // Choose a shift length (2-4 hours)
                const maxShiftLength = Math.min(4, endHour - currentHour);
                const shiftLength = Math.max(2, maxShiftLength);
                
                const shiftEnd = currentHour + shiftLength;
                
                // Check if this slot is already assigned to a work study student
                const conflictingShifts = schedule[day].filter(s => {
                    const sStart = window.timeToHour(s.start);
                    const sEnd = window.timeToHour(s.end);
                    return !(sEnd <= currentHour || sStart >= shiftEnd);
                });
                
                if (conflictingShifts.length === 0) {
                    // Find available workers for this shift
                    const availableWorkers = workersData.filter(worker => {
                        // Skip work study students already assigned
                        if (worker.work_study && assignedHours[worker.email] > 0) {
                            return false;
                        }
                        
                        return window.isWorkerAvailableDuringHours(worker, day, currentHour, shiftEnd) &&
                            assignedHours[worker.email] + shiftLength <= maxHoursPerWorker;
                    });
                    
                    // Sort by assigned hours (ascending) to distribute work evenly
                    availableWorkers.sort((a, b) => (assignedHours[a.email] || 0) - (assignedHours[b.email] || 0));
                    
                    // Assign workers to shift (up to maxWorkersPerShift)
                    const assignedWorkers = availableWorkers.slice(0, maxWorkersPerShift);
                    
                    // Create the shift
                    const shift = {
                        start: window.hourToTimeStr(currentHour),
                        end: window.hourToTimeStr(shiftEnd),
                        assigned: assignedWorkers.length > 0 ? 
                            assignedWorkers.map(w => `${w.first_name} ${w.last_name}`) : 
                            ['Unfilled'],
                        raw_assigned: assignedWorkers.map(w => w.email),
                        available: availableWorkers.map(w => `${w.first_name} ${w.last_name}`),
                        all_available: availableWorkers
                    };
                    
                    // Add to schedule
                    schedule[day].push(shift);
                    
                    // Update assigned hours
                    assignedWorkers.forEach(worker => {
                        assignedHours[worker.email] = (assignedHours[worker.email] || 0) + shiftLength;
                    });
                    
                    // Track unfilled shifts
                    if (assignedWorkers.length === 0) {
                        unfilledShifts.push({
                            day,
                            start: shift.start,
                            end: shift.end
                        });
                        
                        // Find potential workers who are available but over hours limit
                        const potentialWorkers = workersData.filter(worker => 
                            window.isWorkerAvailableDuringHours(worker, day, currentHour, shiftEnd) &&
                            !assignedWorkers.includes(worker)
                        );
                        
                        if (potentialWorkers.length > 0) {
                            const shiftKey = `${day} ${shift.start}-${shift.end}`;
                            alternativeSolutions[shiftKey] = potentialWorkers.map(w => 
                                `${w.first_name} ${w.last_name} (${assignedHours[w.email] || 0} hours)`
                            );
                        }
                    }
                }
                
                // Move to next slot
                currentHour = shiftEnd;
            }
        }
        
        // Sort shifts by start time
        schedule[day].sort((a, b) => window.timeToHour(a.start) - window.timeToHour(b.start));
    }
    
    // Check for unassigned workers and workers with low hours
    const lowHours = [];
    const unassigned = [];
    
    workersData.forEach(worker => {
        const hours = assignedHours[worker.email] || 0;
        
        // Skip work study students (they're handled separately)
        if (worker.work_study) return;
        
        if (hours === 0) {
            unassigned.push(`${worker.first_name} ${worker.last_name}`);
        } else if (hours < minHoursPerWorker) {
            lowHours.push(`${worker.first_name} ${worker.last_name}`);
        }
    });
    
    // Calculate total shifts
    const totalShifts = Object.values(schedule).flat().length;
    
    return {
        schedule,
        assignedHours,
        lowHours,
        unassigned,
        alternativeSolutions,
        unfilledShifts,
        wsIssues,
        totalShifts
    };
}

// Find optimal work study schedule to get exactly 5 hours
function findOptimalWorkStudySchedule(availableSlots, targetHours) {
    // Try different combinations to find exactly 5 hours
    
    // First try: find a single 5-hour slot
    for (const slot of availableSlots) {
        if (Math.abs(slot.duration - targetHours) < 0.1) {
            return {
                slots: [slot],
                totalHours: slot.duration
            };
        }
    }
    
    // Second try: find a 3-hour + 2-hour combination
    for (const slot1 of availableSlots) {
        if (Math.abs(slot1.duration - 3) < 0.1) {
            for (const slot2 of availableSlots) {
                if (slot1 !== slot2 && Math.abs(slot2.duration - 2) < 0.1) {
                    return {
                        slots: [slot1, slot2],
                        totalHours: slot1.duration + slot2.duration
                    };
                }
            }
        }
    }
    
    // Third try: find a 2-hour + 3-hour combination
    for (const slot1 of availableSlots) {
        if (Math.abs(slot1.duration - 2) < 0.1) {
            for (const slot2 of availableSlots) {
                if (slot1 !== slot2 && Math.abs(slot2.duration - 3) < 0.1) {
                    return {
                        slots: [slot1, slot2],
                        totalHours: slot1.duration + slot2.duration
                    };
                }
            }
        }
    }
    
    // Fourth try: find any combination that adds up to 5 hours
    // Sort slots by duration for better fitting
    const sortedSlots = [...availableSlots].sort((a, b) => a.duration - b.duration);
    
    for (let i = 0; i < sortedSlots.length; i++) {
        let totalHours = sortedSlots[i].duration;
        const slots = [sortedSlots[i]];
        
        // Skip if this slot alone is already too long
        if (totalHours > targetHours) continue;
        
        // Try adding more slots
        for (let j = 0; j < sortedSlots.length; j++) {
            if (i !== j) {
                const newTotal = totalHours + sortedSlots[j].duration;
                
                // If adding this slot gets us exactly to the target
                if (Math.abs(newTotal - targetHours) < 0.1) {
                    slots.push(sortedSlots[j]);
                    return {
                        slots,
                        totalHours: newTotal
                    };
                }
                
                // If adding this slot keeps us under the target
                if (newTotal < targetHours) {
                    slots.push(sortedSlots[j]);
                    totalHours = newTotal;
                }
            }
        }
        
        // If we found a combination that works
        if (Math.abs(totalHours - targetHours) < 0.1) {
            return {
                slots,
                totalHours
            };
        }
    }
    
    // If no perfect solution, return the best we could find
    // Just return all available slots (up to a reasonable limit)
    const bestSlots = [];
    let totalHours = 0;
    
    for (const slot of sortedSlots) {
        if (totalHours + slot.duration <= targetHours) {
            bestSlots.push(slot);
            totalHours += slot.duration;
        }
    }
    
    return {
        slots: bestSlots,
        totalHours
    };
}

// Make functions available globally
window.calculateAssignedHours = calculateAssignedHours;
window.displayScheduleWithPublishOption = displayScheduleWithPublishOption;
window.loadCurrentSchedule = loadCurrentSchedule;
window.createScheduleFromAvailability = createScheduleFromAvailability;
window.findOptimalWorkStudySchedule = findOptimalWorkStudySchedule;
