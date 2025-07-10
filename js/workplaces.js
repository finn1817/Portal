// Workplace core functionality
import { collection, doc, getDoc, setDoc, updateDoc, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb } from './firebase-config.js';

// Global variables
window.selectedWorkplace = null;
window.currentWorkplaceData = null;

// Time utility functions
window.timeToHour = function(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    let hourNum = hours + (minutes / 60);
    
    // Handle midnight (00:00) as 24 hours for end times
    if (hours === 0 && minutes === 0) hourNum = 24; 
    
    return hourNum;
};

window.hourToTimeStr = function(hour) {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

window.formatTimeAMPM = function(timeStr) {
    if (!timeStr) return '';
    
    let [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM
    
    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Initialize workplace listeners
document.addEventListener('DOMContentLoaded', function() {
    // Set up workplace selection
    const workplaceCards = document.querySelectorAll('.workplace-card');
    workplaceCards.forEach(card => {
        card.addEventListener('click', function() {
            const workplace = this.getAttribute('data-workplace');
            selectWorkplace(workplace);
        });
    });

    // Load workplaces and render them
    loadAndRenderWorkplaces();
});

// Select workplace
window.selectWorkplace = async function(workplace) {
    console.log('[selectWorkplace] Called with:', workplace);
    window.selectedWorkplace = workplace;
    
    // Update visual selection
    document.querySelectorAll('.workplace-card').forEach(card => {
        card.classList.remove('selected');
    });
    const selectedCard = document.querySelector(`.workplace-card[data-workplace="${workplace}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Ensure the workplace document exists
    await initializeWorkplace(workplace);
    
    // Show workplace content
    document.getElementById('workplaceContent').style.display = 'block';
    
    // Update workplace name in header
    const names = {
        'esports_lounge': '🎮 eSports Lounge',
        'esports_arena': '🏟️ eSports Arena',
        'it_service_center': '💻 IT Service Center'
    };
    
    // Reset the schedule tab content
    const scheduleContent = document.getElementById('scheduleContent');
    if (scheduleContent) {
        scheduleContent.innerHTML = '<p>Select an option above to get started.</p>';
    }
    
    const generateForm = document.getElementById('generateScheduleForm');
    if (generateForm) {
        generateForm.style.display = 'none';
    }
    
    const shiftOverride = document.getElementById('shiftOverrideSection');
    if (shiftOverride) {
        shiftOverride.style.display = 'none';
    }
    
    const scheduleHistory = document.getElementById('scheduleHistorySection');
    if (scheduleHistory) {
        scheduleHistory.style.display = 'none';
    }
    
    // Reset last minute tab content
    const lastMinuteResults = document.getElementById('lastMinuteResults');
    if (lastMinuteResults) {
        lastMinuteResults.style.display = 'none';
    }
    
    // Reset draft schedule
    window.draftSchedule = null;
    
    // Load workplace data
    console.log('[selectWorkplace] Loading workplace data for:', workplace);
    loadWorkplaceData(workplace);
};

// Initialize workplace document if it doesn't exist
async function initializeWorkplace(workplace) {
    try {
        const workplaceRef = doc(workplaceDb, 'workplaces', workplace);
        const workplaceDoc = await getDoc(workplaceRef);
        
        if (!workplaceDoc.exists()) {
            console.log(`Creating new workplace document for ${workplace}`);
            await setDoc(workplaceRef, {
                name: workplace.replace('_', ' ').toUpperCase(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                hours_of_operation: {}
            });
            
            return true;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error initializing workplace:', error);
        return false;
    }
}

// Load workplace data from Firebase
async function loadWorkplaceData(workplace) {
    console.log('[loadWorkplaceData] Called for:', workplace);
    try {
        console.log(`🔍 Loading data for ${workplace} from workplaces collection`);
        
        // Ensure workplace document exists
        await initializeWorkplace(workplace);
        
        // Load workplace document for access throughout the app
        const workplaceRef = doc(workplaceDb, 'workplaces', workplace);
        const workplaceDoc = await getDoc(workplaceRef);
        
        if (workplaceDoc.exists()) {
            window.currentWorkplaceData = workplaceDoc.data();
            console.log('[loadWorkplaceData] Loaded data:', window.currentWorkplaceData);
        }
        
        // Load workers for the workplace
        if (window.loadWorkers) {
            window.loadWorkers(workplace);
        }
        
        // Load hours for the workplace
        if (window.loadHours) {
            window.loadHours(workplace);
        }
    } catch (error) {
        console.error('[loadWorkplaceData] Error:', error);
    }
}

// Load workplaces from Firestore and render to #workplaceGrid
async function loadAndRenderWorkplaces() {
    const grid = document.getElementById('workplaceGrid');
    if (!grid) {
        console.error('[loadAndRenderWorkplaces] #workplaceGrid not found in DOM');
        return;
    }
    grid.innerHTML = '<div class="loading">Loading workplaces...</div>';
    try {
        console.log('[loadAndRenderWorkplaces] Querying workplaces collection...');
        const workplacesQuery = collection(workplaceDb, 'workplaces');
        const querySnapshot = await getDocs(workplacesQuery);
        console.log(`[loadAndRenderWorkplaces] Found ${querySnapshot.size} workplaces`);
        
        if (querySnapshot.empty) {
            // Create default workplaces if none exist
            grid.innerHTML = '';
            const defaultWorkplaces = [
                { id: 'esports_lounge', name: '🎮 eSports Lounge' },
                { id: 'esports_arena', name: '🏟️ eSports Arena' },
                { id: 'it_service_center', name: '💻 IT Service Center' }
            ];
            
            let html = '';
            for (const workplace of defaultWorkplaces) {
                // Create the workplace document in Firebase
                await initializeWorkplace(workplace.id);
                
                html += `
                    <div class="workplace-card" data-workplace="${workplace.id}">
                        <h4>${workplace.name}</h4>
                        <p>${workplace.id}</p>
                    </div>
                `;
            }
            grid.innerHTML = html;
        } else {
            let html = '';
            querySnapshot.forEach((doc) => {
                const id = doc.id;
                const data = doc.data();
                const name = data.name || id.replace('_', ' ').toUpperCase();
                html += `
                    <div class="workplace-card" data-workplace="${id}">
                        <h4>${name}</h4>
                        <p>${id}</p>
                    </div>
                `;
            });
            grid.innerHTML = html;
        }
        
        // Re-attach click listeners
        document.querySelectorAll('.workplace-card').forEach(card => {
            card.addEventListener('click', function() {
                const workplace = this.getAttribute('data-workplace');
                console.log('[workplace-card click] Selected:', workplace);
                selectWorkplace(workplace);
            });
        });
        console.log('[loadAndRenderWorkplaces] Click listeners attached to workplace cards');
    } catch (error) {
        console.error('[loadAndRenderWorkplaces] Error:', error);
        grid.innerHTML = `<div class="loading" style="color: #dc3545;">Error loading workplaces: ${error.message}</div>`;
    }
}

// Load hours for scheduling
window.loadHoursForScheduling = async function(workplace) {
    try {
        // Ensure workplace document exists
        await initializeWorkplace(workplace);
        
        const workplaceRef = doc(workplaceDb, 'workplaces', workplace);
        const workplaceDoc = await getDoc(workplaceRef);
        
        if (workplaceDoc.exists()) {
            const data = workplaceDoc.data();
            return data.hours_of_operation || {};
        }
        
        return {};
    } catch (error) {
        console.error('❌ Error loading hours for scheduling:', error);
        return {};
    }
};

// Load current schedule
window.loadCurrentSchedule = async function() {
    if (!window.selectedWorkplace) {
        throw new Error('No workplace selected');
    }
    
    try {
        // First try to get from schedules subcollection
        const schedulesRef = collection(workplaceDb, 'workplaces', window.selectedWorkplace, 'schedules');
        const querySnapshot = await getDocs(schedulesRef);
        
        if (!querySnapshot.empty) {
            // Get the most recent schedule
            let mostRecent = null;
            let mostRecentDate = null;
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const createdAt = new Date(data.created_at);
                
                if (!mostRecentDate || createdAt > mostRecentDate) {
                    mostRecent = data;
                    mostRecentDate = createdAt;
                }
            });
            
            if (mostRecent && mostRecent.days) {
                return mostRecent.days;
            }
        }
        
        // If no schedules found, return empty
        return null;
    } catch (error) {
        console.error('❌ Error loading current schedule:', error);
        throw error;
    }
};

// Make functions available globally
window.initializeWorkplace = initializeWorkplace;
window.loadWorkplaceData = loadWorkplaceData;