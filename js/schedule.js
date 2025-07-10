// Advanced schedule generation and management
import { collection, getDocs, doc, updateDoc, getDoc, addDoc, query, orderBy, limit, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb, DAYS } from './firebase-config.js';

// Global variables
window.currentSchedule = null;
window.draftSchedule = null;
window.currentShiftOverrides = {};
window.selectedScheduleId = null;

// Advanced scheduling configuration
const SHIFT_LENGTHS = [2, 3, 4, 5]; // Possible shift lengths in hours
const WORK_STUDY_TARGET_HOURS = 5; // Work study students need exactly 5 hours
const PREFERRED_WS_SPLITS = [
    { split1: 3, split2: 2 }, // Preferred 3+2 hour split
    { split1: 2, split2: 3 }  // Alternative 2+3 hour split
];

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    setupScheduleEventListeners();
});

function setupScheduleEventListeners() {
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
}

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

// ADVANCED SCHEDULE GENERATION - Complete implementation
window.generateSchedule = async function() {
    if (!window.selectedWorkplace) {
        alert('Please select a workplace first.');
        return;
    }
    
    document.getElementById('scheduleContent').innerHTML = `
        <div class="loading">🔄 Generating advanced schedule for ${window.selectedWorkplace}...</div>
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
        
        console.log('📊 Generating advanced schedule with:', { 
            workers: workersData.length, 
            hoursData,
            maxHoursPerWorker,
            maxWorkersPerShift,
            minHoursPerWorker
        });
        
        // Validate prerequisites
        const validationResult = validateSchedulingPrerequisites(workersData, hoursData);
        if (!validationResult.valid) {
            document.getElementById('scheduleContent').innerHTML = validationResult.errorHtml;
            return;
        }
        
        // Generate the schedule using the advanced algorithm
        const scheduleResult = await createAdvancedScheduleFromAvailability(
            hoursData, 
            workersData, 
            window.selectedWorkplace,
            maxHoursPerWorker,
            maxWorkersPerShift,
            minHoursPerWorker
        );
        
        // Save the generated schedule to Firebase as a draft
        const scheduleId = await saveScheduleToFirebase(scheduleResult.schedule, false);
        window.draftSchedule = scheduleResult.schedule;
        
        // Hide the generation form
        document.getElementById('generateScheduleForm').style.display = 'none';
        
        // Display the schedule with comprehensive analytics
        displayAdvancedScheduleWithAnalytics(scheduleResult, false, scheduleId);
        
    } catch (error) {
        console.error('❌ Error generating schedule:', error);
        document.getElementById('scheduleContent').innerHTML = `
            <div class="schedule-warning">
                <h5>❌ Error Generating Schedule</h5>
                <p>Error: ${error.message}</p>
                <p><small>Please check your workers' availability and hours of operation settings.</small></p>
            </div>
        `;
    }
};

// Validate prerequisites for schedule generation
function validateSchedulingPrerequisites(workersData, hoursData) {
    if (workersData.length === 0) {
        return {
            valid: false,
            errorHtml: `
                <div class="schedule-warning">
                    <h5>⚠️ No Workers Available</h5>
                    <p>Add workers to the workplace before generating a schedule.</p>
                    <p><small>Navigate to the Workers tab to add workers with their availability.</small></p>
                </div>
            `
        };
    }
    
    if (Object.keys(hoursData).length === 0) {
        return {
            valid: false,
            errorHtml: `
                <div class="schedule-warning">
                    <h5>⚠️ No Hours of Operation</h5>
                    <p>Set hours of operation for the workplace before generating a schedule.</p>
                    <p><small>Navigate to the Hours tab to configure operating hours.</small></p>
                </div>
            `
        };
    }
    
    return { valid: true };
}

// ADVANCED SCHEDULE CREATION ALGORITHM
async function createAdvancedScheduleFromAvailability(hoursOfOperation, workersData, workplace, maxHoursPerWorker, maxWorkersPerShift, minHoursPerWorker) {
    console.log('🚀 Starting advanced schedule generation...');
    
    // Initialize tracking variables
    const schedule = {};
    const assignedHours = {};
    const unfilledShifts = [];
    const alternativeSolutions = {};
    const wsIssues = [];
    
    // Initialize worker hours tracking
    workersData.forEach(w => {
        assignedHours[w.email] = 0;
    });
    
    // Randomize shift lengths for variety
    const shuffledShiftLengths = [...SHIFT_LENGTHS].sort(() => Math.random() - 0.5);
    
    // PHASE 1: Assign work study students exactly 5 hours with optimal splits
    console.log('📋 Phase 1: Assigning work study students...');
    const workStudyWorkers = workersData.filter(w => w.work_study);
    
    // Sort work study workers by availability (least available first to prioritize them)
    workStudyWorkers.sort((a, b) => (a.total_availability_hours || 0) - (b.total_availability_hours || 0));
    
    for (const worker of workStudyWorkers) {
        const assignmentResult = await assignWorkStudyStudent(worker, hoursOfOperation, schedule, assignedHours);
        
        if (assignmentResult.success) {
            console.log(`✅ Assigned ${worker.first_name} ${worker.last_name}: ${assignmentResult.hoursAssigned} hours`);
        } else {
            wsIssues.push(`${worker.first_name} ${worker.last_name}: ${assignmentResult.reason}`);
            console.warn(`⚠️ Could not fully assign ${worker.first_name} ${worker.last_name}: ${assignmentResult.reason}`);
        }
    }
    
    // PHASE 2: Fill remaining time slots with regular workers using fairness algorithm
    console.log('📋 Phase 2: Filling remaining shifts with regular workers...');
    
    // Sort days consistently for predictable results
    const sortedDays = DAYS.filter(day => hoursOfOperation[day] && hoursOfOperation[day].length > 0);
    
    for (const day of sortedDays) {
        const dayHours = hoursOfOperation[day];
        if (!dayHours || dayHours.length === 0) continue;
        
        // Initialize day in schedule if needed
        if (!schedule[day]) schedule[day] = [];
        
        for (const hours of dayHours) {
            await fillDayWithRegularWorkers(
                day, 
                hours, 
                schedule, 
                workersData, 
                assignedHours, 
                maxHoursPerWorker, 
                maxWorkersPerShift, 
                shuffledShiftLengths,
                unfilledShifts,
                alternativeSolutions
            );
        }
        
        // Sort shifts by start time
        schedule[day].sort((a, b) => window.timeToHour(a.start) - window.timeToHour(b.start));
    }
    
    // PHASE 3: Analysis and reporting
    console.log('📋 Phase 3: Analyzing results...');
    
    const analysisResult = analyzeScheduleResults(workersData, assignedHours, minHoursPerWorker);
    
    return {
        schedule,
        assignedHours,
        lowHours: analysisResult.lowHours,
        unassigned: analysisResult.unassigned,
        alternativeSolutions,
        unfilledShifts,
        wsIssues,
        minHoursIssues: analysisResult.minHoursIssues,
        totalShifts: Object.values(schedule).flat().length,
        analytics: analysisResult.analytics
    };
}

// Assign work study student with optimal 3+2 or 2+3 splits
async function assignWorkStudyStudent(worker, hoursOfOperation, schedule, assignedHours) {
    // Find all available time windows for this worker
    const availableWindows = [];
    
    for (const [day, dayHours] of Object.entries(hoursOfOperation)) {
        if (!dayHours || dayHours.length === 0) continue;
        
        for (const hours of dayHours) {
            const startHour = hours.start_hour;
            const endHour = hours.end_hour;
            
            // Get availability intersections
            const intersections = getWorkerAvailabilityIntersections(worker, day, startHour, endHour);
            availableWindows.push(...intersections);
        }
    }
    
    // Try to find optimal 5-hour assignment with preferred splits
    const optimalAssignment = findOptimalWorkStudyAssignment(availableWindows, WORK_STUDY_TARGET_HOURS);
    
    if (optimalAssignment.totalHours >= 4.8) { // Allow slight tolerance
        // Apply the assignment
        for (const window of optimalAssignment.windows) {
            await createWorkStudyShift(worker, window, schedule, assignedHours);
        }
        
        return {
            success: true,
            hoursAssigned: optimalAssignment.totalHours,
            reason: `Assigned ${optimalAssignment.totalHours.toFixed(1)} hours`
        };
    } else {
        return {
            success: false,
            hoursAssigned: optimalAssignment.totalHours,
            reason: `Only ${optimalAssignment.totalHours.toFixed(1)} hours available during operating hours`
        };
    }
}

// Get intersections between worker availability and operating hours
function getWorkerAvailabilityIntersections(worker, day, opStart, opEnd) {
    const availability = worker.availability || {};
    const dayAvailability = availability[day] || [];
    const intersections = [];
    
    for (const avail of dayAvailability) {
        const intersectionStart = Math.max(opStart, avail.start_hour);
        const intersectionEnd = Math.min(opEnd, avail.end_hour);
        
        if (intersectionEnd > intersectionStart) {
            intersections.push({
                day,
                start: intersectionStart,
                end: intersectionEnd,
                duration: intersectionEnd - intersectionStart
            });
        }
    }
    
    return intersections;
}

// Find optimal work study assignment (preferring 3+2 splits)
function findOptimalWorkStudyAssignment(windows, targetHours) {
    // Try perfect 5-hour single window
    for (const window of windows) {
        if (Math.abs(window.duration - targetHours) < 0.1) {
            return {
                windows: [window],
                totalHours: window.duration
            };
        }
    }
    
    // Try preferred 3+2 hour combinations
    for (const split of PREFERRED_WS_SPLITS) {
        const combination = findHourCombination(windows, split.split1, split.split2);
        if (combination) {
            return combination;
        }
    }
    
    // Try any combination that gets close to 5 hours
    return findBestHourCombination(windows, targetHours);
}

// Find specific hour combination (e.g., 3+2)
function findHourCombination(windows, hours1, hours2) {
    for (let i = 0; i < windows.length; i++) {
        const window1 = windows[i];
        if (Math.abs(window1.duration - hours1) < 0.1) {
            
            for (let j = 0; j < windows.length; j++) {
                if (i === j) continue;
                const window2 = windows[j];
                
                if (Math.abs(window2.duration - hours2) < 0.1) {
                    return {
                        windows: [window1, window2],
                        totalHours: window1.duration + window2.duration
                    };
                }
            }
        }
    }
    return null;
}

// Find best combination of hours up to target
function findBestHourCombination(windows, targetHours) {
    const sortedWindows = [...windows].sort((a, b) => b.duration - a.duration);
    let bestCombination = { windows: [], totalHours: 0 };
    
    // Try different combinations
    for (let i = 0; i < sortedWindows.length; i++) {
        let currentCombination = [sortedWindows[i]];
        let currentHours = sortedWindows[i].duration;
        
        if (currentHours > targetHours) continue;
        
        for (let j = 0; j < sortedWindows.length; j++) {
            if (i === j) continue;
            
            const newTotal = currentHours + sortedWindows[j].duration;
            if (newTotal <= targetHours) {
                currentCombination.push(sortedWindows[j]);
                currentHours = newTotal;
            }
        }
        
        if (currentHours > bestCombination.totalHours) {
            bestCombination = {
                windows: currentCombination,
                totalHours: currentHours
            };
        }
    }
    
    return bestCombination;
}

// Create work study shift in schedule
async function createWorkStudyShift(worker, window, schedule, assignedHours) {
    const { day, start, end, duration } = window;
    
    const shift = {
        start: window.hourToTimeStr(start),
        end: window.hourToTimeStr(end),
        assigned: [`${worker.first_name} ${worker.last_name}`],
        raw_assigned: [worker.email],
        available: [`${worker.first_name} ${worker.last_name}`],
        all_available: [worker],
        is_work_study: true
    };
    
    if (!schedule[day]) schedule[day] = [];
    schedule[day].push(shift);
    
    assignedHours[worker.email] = (assignedHours[worker.email] || 0) + duration;
}

// Fill day with regular workers using fairness algorithm
async function fillDayWithRegularWorkers(day, hours, schedule, workersData, assignedHours, maxHoursPerWorker, maxWorkersPerShift, shiftLengths, unfilledShifts, alternativeSolutions) {
    const startHour = hours.start_hour;
    const endHour = hours.end_hour;
    
    // Find free time slots (not occupied by work study students)
    const freeSlots = findFreeTimeSlots(day, startHour, endHour, schedule[day] || []);
    
    for (const slot of freeSlots) {
        await fillTimeSlotWithWorkers(
            day, 
            slot, 
            schedule, 
            workersData, 
            assignedHours, 
            maxHoursPerWorker, 
            maxWorkersPerShift, 
            shiftLengths,
            unfilledShifts,
            alternativeSolutions
        );
    }
}

// Find free time slots not occupied by existing shifts
function findFreeTimeSlots(day, startHour, endHour, existingShifts) {
    const freeSlots = [{ start: startHour, end: endHour }];
    
    // Remove time occupied by existing shifts
    for (const shift of existingShifts) {
        const shiftStart = window.timeToHour(shift.start);
        const shiftEnd = window.timeToHour(shift.end);
        
        const newFreeSlots = [];
        for (const slot of freeSlots) {
            if (slot.end <= shiftStart || slot.start >= shiftEnd) {
                // No overlap
                newFreeSlots.push(slot);
            } else {
                // Overlap - split the slot
                if (slot.start < shiftStart) {
                    newFreeSlots.push({ start: slot.start, end: shiftStart });
                }
                if (slot.end > shiftEnd) {
                    newFreeSlots.push({ start: shiftEnd, end: slot.end });
                }
            }
        }
        freeSlots.splice(0, freeSlots.length, ...newFreeSlots);
    }
    
    return freeSlots.filter(slot => slot.end - slot.start >= 2); // Minimum 2-hour shifts
}

// Fill time slot with workers using fairness algorithm
async function fillTimeSlotWithWorkers(day, slot, schedule, workersData, assignedHours, maxHoursPerWorker, maxWorkersPerShift, shiftLengths, unfilledShifts, alternativeSolutions) {
    let currentHour = slot.start;
    
    while (currentHour < slot.end) {
        // Determine shift length
        const maxPossibleLength = Math.min(5, slot.end - currentHour);
        const availableLengths = shiftLengths.filter(length => length <= maxPossibleLength);
        const shiftLength = availableLengths[Math.floor(Math.random() * availableLengths.length)] || 2;
        
        const shiftEnd = Math.min(currentHour + shiftLength, slot.end);
        const actualShiftLength = shiftEnd - currentHour;
        
        if (actualShiftLength < 2) break; // Don't create shifts shorter than 2 hours
        
        // Find available workers using fairness algorithm
        const availableWorkers = findAvailableWorkersForShift(
            workersData, 
            day, 
            currentHour, 
            shiftEnd, 
            assignedHours, 
            maxHoursPerWorker
        );
        
        // Apply fairness sorting
        availableWorkers.sort((a, b) => {
            const hoursA = assignedHours[a.email] || 0;
            const hoursB = assignedHours[b.email] || 0;
            return hoursA - hoursB; // Ascending order - workers with fewer hours first
        });
        
        // Select workers for this shift
        const selectedWorkers = availableWorkers.slice(0, maxWorkersPerShift);
        
        // Create the shift
        const shift = {
            start: window.hourToTimeStr(currentHour),
            end: window.hourToTimeStr(shiftEnd),
            assigned: selectedWorkers.length > 0 ? 
                selectedWorkers.map(w => `${w.first_name} ${w.last_name}`) : 
                ['Unfilled'],
            raw_assigned: selectedWorkers.map(w => w.email),
            available: availableWorkers.map(w => `${w.first_name} ${w.last_name}`),
            all_available: availableWorkers
        };
        
        // Add to schedule
        if (!schedule[day]) schedule[day] = [];
        schedule[day].push(shift);
        
        // Update assigned hours
        selectedWorkers.forEach(worker => {
            assignedHours[worker.email] = (assignedHours[worker.email] || 0) + actualShiftLength;
        });
        
        // Track unfilled shifts and find alternatives
        if (selectedWorkers.length === 0) {
            unfilledShifts.push({
                day,
                start: shift.start,
                end: shift.end
            });
            
            // Find alternative workers (who might be over hours limit)
            const alternativeWorkers = workersData.filter(worker => 
                window.isWorkerAvailableDuringHours(worker, day, currentHour, shiftEnd) &&
                !selectedWorkers.includes(worker)
            );
            
            if (alternativeWorkers.length > 0) {
                const shiftKey = `${day} ${shift.start}-${shift.end}`;
                alternativeSolutions[shiftKey] = alternativeWorkers.map(w => 
                    `${w.first_name} ${w.last_name} (${(assignedHours[w.email] || 0).toFixed(1)} hours)`
                );
            }
        }
        
        currentHour = shiftEnd;
    }
}

// Find available workers for a specific shift
function findAvailableWorkersForShift(workersData, day, startHour, endHour, assignedHours, maxHoursPerWorker) {
    return workersData.filter(worker => {
        // Skip work study students who already have their 5 hours
        if (worker.work_study && (assignedHours[worker.email] || 0) >= WORK_STUDY_TARGET_HOURS) {
            return false;
        }
        
        // Check availability
        if (!window.isWorkerAvailableDuringHours(worker, day, startHour, endHour)) {
            return false;
        }
        
        // Check hours limit
        const currentHours = assignedHours[worker.email] || 0;
        const shiftDuration = endHour - startHour;
        
        return currentHours + shiftDuration <= maxHoursPerWorker;
    });
}

// Analyze schedule results and generate comprehensive analytics
function analyzeScheduleResults(workersData, assignedHours, minHoursPerWorker) {
    const lowHours = [];
    const unassigned = [];
    const minHoursIssues = [];
    
    // Analyze each worker
    workersData.forEach(worker => {
        const hours = assignedHours[worker.email] || 0;
        const workerName = `${worker.first_name} ${worker.last_name}`;
        
        if (worker.work_study) {
            // Work study analysis handled separately
            return;
        }
        
        if (hours === 0) {
            unassigned.push(workerName);
        } else if (hours < 4) {
            lowHours.push(workerName);
        }
        
        if (hours < minHoursPerWorker) {
            minHoursIssues.push(workerName);
        }
    });
    
    // Generate comprehensive analytics
    const analytics = generateScheduleAnalytics(workersData, assignedHours);
    
    return {
        lowHours,
        unassigned,
        minHoursIssues,
        analytics
    };
}

// Generate comprehensive schedule analytics
function generateScheduleAnalytics(workersData, assignedHours) {
    const totalWorkers = workersData.length;
    const workStudyWorkers = workersData.filter(w => w.work_study).length;
    const regularWorkers = totalWorkers - workStudyWorkers;
    
    const assignedWorkers = Object.keys(assignedHours).filter(email => assignedHours[email] > 0).length;
    const totalHoursAssigned = Object.values(assignedHours).reduce((sum, hours) => sum + hours, 0);
    const averageHoursPerWorker = assignedWorkers > 0 ? totalHoursAssigned / assignedWorkers : 0;
    
    // Work study analytics
    const workStudyFullyAssigned = workersData.filter(w => 
        w.work_study && Math.abs((assignedHours[w.email] || 0) - WORK_STUDY_TARGET_HOURS) < 0.1
    ).length;
    
    return {
        totalWorkers,
        workStudyWorkers,
        regularWorkers,
        assignedWorkers,
        unassignedWorkers: totalWorkers - assignedWorkers,
        totalHoursAssigned: totalHoursAssigned.toFixed(1),
        averageHoursPerWorker: averageHoursPerWorker.toFixed(1),
        workStudyFullyAssigned,
        workStudyIssues: workStudyWorkers - workStudyFullyAssigned
    };
}

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

    // Add debug logs
    console.log('DEBUG: window.workers:', window.workers);
    console.log('DEBUG: schedule:', schedule);

    const assignedHours = calculateAssignedHours(schedule);

    console.log('DEBUG: assignedHours:', assignedHours);

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
            const isWorkStudy = shift.is_work_study || false;
            html += `
                <div class="schedule-shift ${isUnfilled ? 'unfilled' : ''} ${isWorkStudy ? 'work-study' : ''}">
                    <div class="schedule-time">
                        ${window.formatTimeAMPM(shift.start)} - ${window.formatTimeAMPM(shift.end)}
                        ${isWorkStudy ? '<small style="color: #28a745;">(Work Study)</small>' : ''}
                    </div>
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

// Enhanced schedule display with comprehensive analytics
function displayAdvancedScheduleWithAnalytics(scheduleResult, isCurrent = false, scheduleId = null) {
    const { schedule, assignedHours, analytics, wsIssues, unfilledShifts } = scheduleResult;

    // Add debug logs
    console.log('DEBUG: window.workers:', window.workers);
    console.log('DEBUG: schedule:', schedule);
    console.log('DEBUG: assignedHours:', assignedHours);

    // Calculate display statistics
    const totalShifts = Object.values(schedule).flat().length;
    const unfilledCount = unfilledShifts.length;
    const assignedWorkers = Object.keys(assignedHours).filter(email => assignedHours[email] > 0).length;
    
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
    
    // Enhanced statistics dashboard
    html += `
        <div class="stats" style="margin-bottom: 2rem;">
            <div class="stat-card">
                <div class="stat-number">${totalShifts}</div>
                <div class="stat-label">Total Shifts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${unfilledCount}</div>
                <div class="stat-label">Unfilled Shifts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${assignedWorkers}</div>
                <div class="stat-label">Workers Assigned</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${analytics.totalHoursAssigned}</div>
                <div class="stat-label">Total Hours</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${analytics.averageHoursPerWorker}</div>
                <div class="stat-label">Avg Hours/Worker</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${analytics.workStudyFullyAssigned}/${analytics.workStudyWorkers}</div>
                <div class="stat-label">Work Study OK</div>
            </div>
        </div>
    `;
    
    // Show comprehensive warnings
    if (wsIssues.length > 0 || unfilledShifts.length > 0) {
        html += generateWarningSection(wsIssues, unfilledShifts, scheduleResult.alternativeSolutions);
    }
    
    // Display schedule by day with enhanced formatting
    html += generateScheduleDisplayByDay(schedule);
    
    // Enhanced worker hours summary with analytics
    html += generateEnhancedWorkerSummary(assignedHours, analytics);
    
    // Export and print options
    html += generateExportOptions();
    
    document.getElementById('scheduleContent').innerHTML = html;
}

// Generate warning section for issues
function generateWarningSection(wsIssues, unfilledShifts, alternativeSolutions) {
    let html = '';
    
    if (wsIssues.length > 0) {
        html += `
            <div class="schedule-warning">
                <h5>⚠️ Work Study Issues</h5>
                <p>The following work study students could not be assigned exactly ${WORK_STUDY_TARGET_HOURS} hours:</p>
                <ul>
                    ${wsIssues.map(issue => `<li class="work-study-issue">${issue}</li>`).join('')}
                </ul>
                <p><small>Consider adjusting their availability or the hours of operation.</small></p>
            </div>
        `;
    }
    
    if (unfilledShifts.length > 0) {
        html += `
            <div class="schedule-warning">
                <h5>⚠️ Unfilled Shifts (${unfilledShifts.length})</h5>
                <p>The following shifts could not be filled:</p>
                <ul>
        `;
        
        unfilledShifts.forEach(shift => {
            const shiftKey = `${shift.day} ${shift.start}-${shift.end}`;
            const alternatives = alternativeSolutions[shiftKey] || [];
            
            html += `<li>
                ${shift.day} ${window.formatTimeAMPM(shift.start)}-${window.formatTimeAMPM(shift.end)}
                ${alternatives.length > 0 ? `<br><small style="color: #6c757d;">Alternatives: ${alternatives.join(', ')}</small>` : ''}
            </li>`;
        });
        
        html += `
                </ul>
                <p><small>Consider adjusting worker availability, hours limits, or hiring additional staff.</small></p>
            </div>
        `;
    }
    
    return html;
}

// Generate schedule display by day
function generateScheduleDisplayByDay(schedule) {
    let html = '<h5 style="margin-top: 2rem;">Schedule by Day</h5>';
    
    for (const day of DAYS) {
        const shifts = schedule[day] || [];
        if (shifts.length === 0) continue;
        
        html += `<div class="schedule-day-header">${day}</div>`;
        
        shifts.forEach(shift => {
            const isUnfilled = shift.assigned && shift.assigned.includes('Unfilled');
            const isWorkStudy = shift.is_work_study || false;
            
            html += `
                <div class="schedule-shift ${isUnfilled ? 'unfilled' : ''} ${isWorkStudy ? 'work-study' : ''}">
                    <div class="schedule-time">
                        ${window.formatTimeAMPM(shift.start)} - ${window.formatTimeAMPM(shift.end)}
                        ${isWorkStudy ? '<small style="color: #28a745;">(Work Study)</small>' : ''}
                    </div>
                    <div class="schedule-workers">
                        ${isUnfilled ? '<span class="unfilled-text">Unfilled</span>' : shift.assigned.join(', ')}
                    </div>
                </div>
            `;
        });
    }
    
    return html;
}

// Generate enhanced worker summary
function generateEnhancedWorkerSummary(assignedHours, analytics) {
    let html = `
        <h5 style="margin-top: 2rem;">Worker Hours Analysis</h5>
        <div style="margin-bottom: 1rem;">
            <p><strong>Summary:</strong> ${analytics.assignedWorkers} of ${analytics.totalWorkers} workers assigned, 
            ${analytics.totalHoursAssigned} total hours, ${analytics.averageHoursPerWorker} average hours per worker</p>
        </div>
        <table class="user-table">
            <thead>
                <tr>
                    <th>Worker</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Utilization</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Sort workers by hours (descending) then by name
    const sortedWorkers = Object.entries(assignedHours).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]; // By hours descending
        // By name if hours are equal
        const workerA = window.workers.find(w => w.email === a[0]);
        const workerB = window.workers.find(w => w.email === b[0]);
        if (workerA && workerB) {
            return `${workerA.first_name} ${workerA.last_name}`.localeCompare(`${workerB.first_name} ${workerB.last_name}`);
        }
        return 0;
    });
    
    sortedWorkers.forEach(([email, hours]) => {
        const worker = window.workers.find(w => w.email === email);
        if (!worker) return;
        
        const name = `${worker.first_name} ${worker.last_name}`;
        const isWorkStudy = worker.work_study === true || worker.work_study === 'Yes';
        const availableHours = worker.total_availability_hours || 0;
        const utilization = availableHours > 0 ? ((hours / availableHours) * 100).toFixed(1) : '0.0';
        
        let status = '';
        let statusClass = '';
        
        if (isWorkStudy) {
            if (Math.abs(hours - WORK_STUDY_TARGET_HOURS) < 0.1) {
                status = 'Perfect (5 hrs)';
                statusClass = '';
            } else {
                status = `WS Issue (${hours.toFixed(1)} hrs)`;
                statusClass = 'unfilled-text';
            }
        } else {
            if (hours === 0) {
                status = 'Unassigned';
                statusClass = 'unfilled-text';
            } else if (hours < 3) {
                status = 'Low Hours';
                statusClass = 'unfilled-text';
            } else {
                status = 'OK';
                statusClass = '';
            }
        }
        
        html += `
            <tr>
                <td>${name} ${isWorkStudy ? '<small>(Work Study)</small>' : ''}</td>
                <td>${hours.toFixed(1)}</td>
                <td class="${statusClass}">${status}</td>
                <td>${utilization}%</td>
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
                <td>0.0%</td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    return html;
}

// Generate export options
function generateExportOptions() {
    return `
        <div style="margin-top: 2rem; padding: 1.5rem; background: #f8f9fa; border-radius: 8px;">
            <h5>📤 Export & Share Options</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <button onclick="printSchedule()" class="history-btn" style="background: #6c757d;">
                    🖨️ Print Schedule
                </button>
                <button onclick="exportScheduleToExcel()" class="history-btn" style="background: #28a745;">
                    📊 Export to Excel
                </button>
                <button onclick="emailSchedule()" class="history-btn" style="background: #007bff;">
                    📧 Email Schedule
                </button>
                <button onclick="copyScheduleToClipboard()" class="history-btn" style="background: #17a2b8;">
                    📋 Copy to Clipboard
                </button>
            </div>
        </div>
    `;
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

// Copy schedule to clipboard
window.copyScheduleToClipboard = async function() {
    const scheduleToCopy = window.draftSchedule || window.currentSchedule;
    if (!scheduleToCopy) {
        alert('No schedule to copy.');
        return;
    }
    
    let text = `${window.selectedWorkplace.replace('_', ' ').toUpperCase()} SCHEDULE\n`;
    text += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    
    for (const day of DAYS) {
        const shifts = scheduleToCopy[day] || [];
        if (shifts.length === 0) continue;
        
        text += `${day.toUpperCase()}\n`;
        text += '=' + '='.repeat(day.length) + '\n';
        
        shifts.forEach(shift => {
            const isUnfilled = shift.assigned && shift.assigned.includes('Unfilled');
            text += `${window.formatTimeAMPM(shift.start)} - ${window.formatTimeAMPM(shift.end)}: `;
            text += isUnfilled ? 'UNFILLED' : shift.assigned.join(', ');
            text += '\n';
        });
        text += '\n';
    }
    
    try {
        await navigator.clipboard.writeText(text);
        alert('✅ Schedule copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        alert('❌ Failed to copy to clipboard. Please try again.');
    }
};

// Add CSS for work study shifts
const workStudyStyles = `
<style>
.schedule-shift.work-study {
    border-left-color: #28a745;
    background-color: rgba(40, 167, 69, 0.1);
}
</style>
`;

// Inject styles if not already present
if (!document.getElementById('schedule-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'schedule-styles';
    styleElement.innerHTML = workStudyStyles;
    document.head.appendChild(styleElement);
}

// Export functions to global scope
window.createAdvancedScheduleFromAvailability = createAdvancedScheduleFromAvailability;
window.displayAdvancedScheduleWithAnalytics = displayAdvancedScheduleWithAnalytics;
window.generateScheduleAnalytics = generateScheduleAnalytics;
window.calculateAssignedHours = calculateAssignedHours;
window.displayScheduleWithPublishOption = displayScheduleWithPublishOption;
window.loadCurrentSchedule = loadCurrentSchedule;