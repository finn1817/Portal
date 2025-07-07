// Worker management
import { collection, getDocs, doc, deleteDoc, addDoc, query, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb } from '/Portal/js/firebase-config.js';

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

// Load workers
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
            
            window.workers.push({
                id: doc.id,
                first_name: firstName,
                last_name: lastName,
                email: email,
                work_study: workStudy === 'Yes' || workStudy === true,
                availability_text: availability,
                availability: availabilityObj,
                ...data // Include all original data
            });
        });

        console.log(`✅ Found ${window.workers.length} workers in ${workplace}`);
        displayWorkers(window.workers);
    } catch (error) {
        console.error('❌ Error loading workers:', error);
        document.getElementById('workersLoading').textContent = 'Error loading workers: ' + error.message;
    }
};

// Display workers
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
            
            console.log('🎯 Displaying worker:', { name, email, workStudy, availability });
            
            row.innerHTML = `
                <td>${name}</td>
                <td>${email}</td>
                <td>
                    <span class="status-badge ${(workStudy === 'Yes' || workStudy === true) ? 'status-admin' : 'status-user'}">
                        ${workStudy === 'Yes' || workStudy === true ? 'Yes' : 'No'}
                    </span>
                </td>
                <td style="max-width: 200px; word-wrap: break-word;">${availability}</td>
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

// Add a new worker
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

    try {
        // Ensure workplace document exists
        await window.initializeWorkplace(window.selectedWorkplace);
        
        console.log(`➕ Adding worker to workplaces/${window.selectedWorkplace}/workers collection`);
        
        // Parse availability text to structured format
        const availabilityObj = parseAvailabilityText(availability);
        
        // Create the new worker object using EXACT field names with spaces
        const newWorker = {
            'First Name': firstName,
            'Last Name': lastName,
            'Email': email,
            'Work Study': workStudy,
            'Days & Times Available': availability,
            'availability': availabilityObj, // Add the parsed availability object
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

// Delete a worker
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

// Parse availability text into structured format
function parseAvailabilityText(availabilityText) {
    const availability = {};
    if (!availabilityText) return availability;

    const blocks = availabilityText.split(',').map(s => s.trim());
    
    blocks.forEach(block => {
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
            
            if (!availability[dayName]) {
                availability[dayName] = [];
            }
            
            availability[dayName].push({
                start: start,
                end: end,
                start_hour: window.timeToHour(start),
                end_hour: window.timeToHour(end)
            });
        }
    });
    
    return availability;
}

// Load workers for scheduling (returns formatted worker data)
window.loadWorkersForScheduling = async function(workplace) {
    if (window.workers.length > 0) {
        // Use already loaded workers if available
        return window.workers;
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
        
        workersData.push({
            id: doc.id,
            first_name: firstName,
            last_name: lastName,
            email: email,
            work_study: workStudy === 'Yes' || workStudy === true,
            availability_text: availabilityText,
            availability: availabilityObj
        });
    });
    
    window.workers = workersData;
    return workersData;
};

// Export functions
export { parseAvailabilityText, displayWorkers };
