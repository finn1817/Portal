// Authentication logic for login/register
import { collection, getDocs, query, where, addDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { userDb } from 'Portal/js/firebase-config.js';

document.addEventListener('DOMContentLoaded', function() {
    // Toggle between login and register forms
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const loginForm = document.querySelector('.login-form');
    const registerForm = document.querySelector('.register-form');
    
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function(e) {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        });
    }
    
    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
        });
    }
    
    // Login handler
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async function() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginError = document.getElementById('loginError');
            
            if (!email || !password) {
                loginError.textContent = 'Please enter both email and password.';
                return;
            }
            
            try {
                loginError.textContent = '';
                loginBtn.disabled = true;
                loginBtn.textContent = 'Logging in...';
                
                // Query users collection
                const usersRef = collection(userDb, 'users');
                const q = query(usersRef, where('email', '==', email));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    loginError.textContent = 'Invalid email or password.';
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Login';
                    return;
                }
                
                let userFound = false;
                
                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData.password === password) {
                        // Successful login
                        userFound = true;
                        
                        // Store user info in localStorage
                        const user = {
                            id: doc.id,
                            email: userData.email,
                            isAdmin: userData.isAdmin || 0,
                            lastLogin: new Date().toISOString()
                        };
                        
                        localStorage.setItem('user', JSON.stringify(user));
                        
                        // Redirect to dashboard
                        window.location.href = 'dashboard.html';
                    }
                });
                
                if (!userFound) {
                    loginError.textContent = 'Invalid email or password.';
                }
                
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
                
            } catch (error) {
                console.error('Login error:', error);
                loginError.textContent = 'An error occurred during login.';
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        });
    }
    
    // Register handler
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', async function() {
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const registerError = document.getElementById('registerError');
            
            if (!email || !password || !confirmPassword) {
                registerError.textContent = 'Please fill in all fields.';
                return;
            }
            
            if (password !== confirmPassword) {
                registerError.textContent = 'Passwords do not match.';
                return;
            }
            
            try {
                registerError.textContent = '';
                registerBtn.disabled = true;
                registerBtn.textContent = 'Registering...';
                
                // Check if email already exists
                const usersRef = collection(userDb, 'users');
                const q = query(usersRef, where('email', '==', email));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    registerError.textContent = 'Email is already registered.';
                    registerBtn.disabled = false;
                    registerBtn.textContent = 'Register';
                    return;
                }
                
                // Add new user
                const newUser = {
                    email: email,
                    password: password, // Note: In a real app, you should hash passwords
                    isAdmin: 0, // Default to regular user
                    createdAt: new Date().toISOString()
                };
                
                const docRef = await addDoc(usersRef, newUser);
                console.log('User registered with ID:', docRef.id);
                
                // Redirect to login or automatically log in
                alert('Registration successful! Please log in.');
                registerForm.style.display = 'none';
                loginForm.style.display = 'block';
                
                registerBtn.disabled = false;
                registerBtn.textContent = 'Register';
                
            } catch (error) {
                console.error('Registration error:', error);
                registerError.textContent = 'An error occurred during registration.';
                registerBtn.disabled = false;
                registerBtn.textContent = 'Register';
            }
        });
    }
});
