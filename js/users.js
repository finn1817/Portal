// User management functionality
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { userDb } from './firebase-config.js';

// Global variable for tracking users
let users = [];

// Load users from Firebase
window.loadUsers = async function() {
    try {
        const usersQuery = query(collection(userDb, "users"), orderBy("email"));
        const querySnapshot = await getDocs(usersQuery);
        
        users = [];
        querySnapshot.forEach((doc) => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });

        displayUsers(users);
        updateStats(users);
    } catch (error) {
        console.error("Error loading users:", error);
        document.getElementById('usersLoading').textContent = "Error loading users: " + error.message;
    }
};

// Display users in the table
function displayUsers(users) {
    const userData = JSON.parse(localStorage.getItem('user'));
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        const isCurrentUser = user.email === userData.email;
        const userIsAdmin = user.isAdmin === 1;
        
        row.innerHTML = `
            <td>
                ${user.email}
                ${isCurrentUser ? '<small style="color: #007bff;"> (You)</small>' : ''}
            </td>
            <td>
                <span class="status-badge ${userIsAdmin ? 'status-admin' : 'status-user'}">
                    ${userIsAdmin ? 'Administrator' : 'User'}
                </span>
            </td>
            <td>
                ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </td>
            <td>
                ${!isCurrentUser ? `
                    ${!userIsAdmin ? 
                        `<button class="action-btn promote-btn" onclick="changeUserStatus('${user.id}', 1)">
                            ⬆️ Make Admin
                        </button>` : 
                        `<button class="action-btn demote-btn" onclick="changeUserStatus('${user.id}', 0)">
                            ⬇️ Remove Admin
                        </button>`
                    }
                    <button class="action-btn delete-btn" onclick="deleteUser('${user.id}', '${user.email}')">
                        🗑️ Delete
                    </button>
                ` : '<em>Current User</em>'}
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('usersLoading').style.display = 'none';
    document.getElementById('usersContainer').style.display = 'block';
}

// Update user statistics
function updateStats(users) {
    const totalUsers = users.length;
    const totalAdmins = users.filter(u => u.isAdmin === 1).length;
    const totalRegularUsers = totalUsers - totalAdmins;

    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('totalAdmins').textContent = totalAdmins;
    document.getElementById('totalRegularUsers').textContent = totalRegularUsers;
}

// Change user status (admin/regular)
window.changeUserStatus = async function(userId, newStatus) {
    try {
        const userRef = doc(userDb, "users", userId);
        await updateDoc(userRef, {
            isAdmin: newStatus
        });
        
        const statusText = newStatus === 1 ? 'promoted to admin' : 'demoted to user';
        alert(`✅ User successfully ${statusText}!`);
        
        window.loadUsers();
    } catch (error) {
        console.error("Error updating user:", error);
        alert("❌ Error updating user: " + error.message);
    }
};

// Delete user
window.deleteUser = async function(userId, userEmail) {
    if (confirm(`⚠️ Are you sure you want to delete the user "${userEmail}"?\n\nThis action cannot be undone.`)) {
        try {
            await deleteDoc(doc(userDb, "users", userId));
            alert(`✅ User "${userEmail}" has been deleted successfully.`);
            window.loadUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("❌ Error deleting user: " + error.message);
        }
    }
};
