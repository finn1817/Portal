// Workplace core functionality
import { collection, doc, getDoc, setDoc, updateDoc, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { workplaceDb } from './firebase-config.js';

// Global variables
window.selectedWorkplace = null;
window.currentWorkplaceData = null;

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
    window.selectedWorkplace = workplace;
    
    // Update visual selection
    document.querySelectorAll('.workplace-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`.workplace-card[data-workplace="${workplace}"]`).classList.add('selected');
    
    // Ensure the workplace document exists
    await initializeWorkplace(workplace);
    
    // Show workplace content
    document.getElementById('workplaceContent').style.display = 'block';
    
    // Update workplace name
    const names = {
        'esports_lounge': '🎮 eSports Lounge',
        'esports_arena': '🏟️ eSports Arena',
        'it_service_center': '💻 IT Service Center'
    };
    document.getElementById('selectedWorkplaceName').textContent = names[workplace];
    
    // Reset the schedule tab content
    document.getElementById('scheduleContent').innerHTML = '<p>Select an option above to get started.</p>';
    document.getElementById('generateScheduleForm').style.display = 'none';
    document.getElementById('shiftOverrideSection').style.display = 'none';
    document.getElementById('scheduleHistorySection').style.display = 'none';
    
    // Reset last minute tab content
    document.getElementById('lastMinuteResults').style.display = 'none';
    
    // Reset draft schedule
    window.draftSchedule = null;
    
    // Load workplace data
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
    try {
        console.log(`🔍 Loading data for ${workplace} from workplaces collection`);
        
        // Ensure workplace document exists
        await initializeWorkplace(workplace);
        
        // Load workplace document for access throughout the app
        const workplaceRef = doc(workplaceDb, 'workplaces', workplace);
        const workplaceDoc = await getDoc(workplaceRef);
        
        if (workplaceDoc.exists()) {
            window.currentWorkplaceData = workplaceDoc.data();
        }
        
        // Load workers for the workplace
        window.loadWorkers(workplace);
    } catch (error) {
        console.error('❌ Error loading workplace data:', error);
    }
}

// Load workplaces from Firestore and render to #workplaceGrid
async function loadAndRenderWorkplaces() {
    const grid = document.getElementById('workplaceGrid');
    if (!grid) {
        console.error('❌ #workplaceGrid not found in DOM');
        return;
    }
    grid.innerHTML = '<div class="loading">Loading workplaces...</div>';
    try {
        console.log('🔍 Querying workplaces collection...');
        const workplacesQuery = collection(workplaceDb, 'workplaces');
        const querySnapshot = await getDocs(workplacesQuery);
        console.log(`✅ Found ${querySnapshot.size} workplaces`);
        if (querySnapshot.empty) {
            grid.innerHTML = '<div class="loading">No workplaces found. Please add workplaces in Firestore.</div>';
            return;
        }
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
        // Re-attach click listeners
        document.querySelectorAll('.workplace-card').forEach(card => {
            card.addEventListener('click', function() {
                const workplace = this.getAttribute('data-workplace');
                selectWorkplace(workplace);
            });
        });
    } catch (error) {
        console.error('❌ Error loading workplaces:', error);
        grid.innerHTML = `<div class="loading" style="color: #dc3545;">Error loading workplaces: ${error.message}</div>`;
    }
}

// Make functions available globally
window.initializeWorkplace = initializeWorkplace;
window.loadWorkplaceData = loadWorkplaceData;
