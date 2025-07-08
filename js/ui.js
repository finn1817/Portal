// UI helper functions for dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const userData = JSON.parse(localStorage.getItem('user'));
    if (!userData && window.location.pathname.includes('dashboard')) {
        window.location.href = 'index.html';
        return;
    }
    
    // Set up user info in dashboard
    if (userData) {
        const emailName = userData.email.split('@')[0];
        document.getElementById('userEmail').textContent = userData.email;
        document.getElementById('welcomeName').textContent = emailName;
        const isAdmin = userData.isAdmin === 1;
        
        document.getElementById('userRole').textContent = isAdmin ? 'Admin' : 'User';
        document.getElementById('accountType').textContent = isAdmin ? 'Administrator' : 'Standard User';
        document.getElementById('lastLogin').textContent = new Date().toLocaleString();
        document.getElementById('loginTime').textContent = new Date().toLocaleString();
        
        if (isAdmin) {
            document.getElementById('userRole').classList.add('admin-role');
            document.body.classList.add('admin');
        }

        // Profile Modal Data
        document.getElementById('profileEmail').textContent = userData.email;
        document.getElementById('profileType').textContent = isAdmin ? 'Administrator' : 'Standard User';
        document.getElementById('profileId').textContent = userData.id || 'N/A';
        document.getElementById('profileCreated').textContent = 'Member since account creation';
    }
    
    // Feature cards modal opening
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal');
            openModal(modalId);
            
            if (modalId === 'analyticsModal') {
                updateAnalytics();
            }
        });
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', function() {
            const modalId = this.getAttribute('data-close-modal');
            closeModal(modalId);
        });
    });
    
    // Click outside modal to close
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
    
    // User management buttons
    const manageUsersBtn = document.getElementById('manageUsers');
    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', function() {
            document.getElementById('userManagement').style.display = 'block';
            window.loadUsers();
        });
    }
    
    const closeUserManagementBtn = document.getElementById('closeUserManagement');
    if (closeUserManagementBtn) {
        closeUserManagementBtn.addEventListener('click', function() {
            document.getElementById('userManagement').style.display = 'none';
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }
    
    // Theme toggle
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        let isDark = false;
        themeToggleBtn.addEventListener('click', function() {
            isDark = !isDark;
            document.body.className = isDark ? 'dark admin' : 'light admin';
            themeToggleBtn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        });
    }
    
    // Profile button
    const myProfileBtn = document.getElementById('myProfile');
    if (myProfileBtn) {
        myProfileBtn.addEventListener('click', function() {
            openModal('profileModal');
        });
    }
    
    // Tabs functionality
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
});

// Open modal
window.openModal = function(modalId) {
    document.getElementById(modalId).style.display = 'block';
};

// Close modal
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

// Switch tab
window.switchTab = function(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    // Patch: Only add 'active' if the tab content exists
    const tabContent = document.getElementById(tabName + '-tab');
    if (tabContent) {
        tabContent.classList.add('active');
    } else {
        console.warn(`Tab content for '${tabName}' not found (id: ${tabName}-tab)`);
    }
    // Load specific data for tab
    if (tabName === 'hours') {
        window.loadHours(window.selectedWorkplace);
    }
};

// Update analytics data
window.updateAnalytics = function() {
    const totalUsers = document.getElementById('totalUsers').textContent || '0';
    document.getElementById('analyticsUsers').textContent = totalUsers;
    document.getElementById('analyticsLogins').textContent = Math.floor(Math.random() * 50) + 10;
    document.getElementById('analyticsNewUsers').textContent = Math.floor(Math.random() * 10) + 1;
};

// Helper function for displaying nice times
window.formatTimeAMPM = function(timeStr) {
    if (!timeStr) return '';
    
    let [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM
    
    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Time conversion functions
window.timeToHour = function(timeStr) {
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
