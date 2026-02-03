// API SERVICE
class ApiService {
    constructor(baseUrl = 'api') {
        this.baseUrl = baseUrl;
    }

    async request(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) config.body = JSON.stringify(data);
        try {
            const response = await fetch(`${this.baseUrl}/${endpoint}`, config);
            return await response.json();
        } catch (error) {
            return { success: false, message: 'Connection error' };
        }
    }

    async login(email, password) { return this.request('auth.php?action=login', 'POST', { email, password }); }
    async register(data) { return this.request('auth.php?action=register', 'POST', data); }
    async logout() { return this.request('auth.php?action=logout', 'POST'); }
    async checkSession() { return this.request('auth.php?action=check', 'GET'); }
    async getFichajes(userId = null) {
        let url = 'fichajes.php';
        if (userId) url += `?user_id=${userId}`;
        return this.request(url, 'GET');
    }
    async saveFichaje(data) { return this.request('fichajes.php', 'POST', data); }
    async getAllFichajes() { return this.request('fichajes.php?action=all', 'GET'); }
    async getAllUsers() { return this.request('auth.php?action=get_users', 'GET'); }
    async uploadSignature(base64Image) { return this.request('upload.php', 'POST', { image: base64Image }); }

    // Companies API
    async getCompanies() { return this.request('companies.php', 'GET'); }
    async saveCompany(data) { return this.request('companies.php', 'POST', data); }
    async deleteCompany(id) { return this.request('companies.php?action=delete', 'POST', { id }); }
    async adminUpdateUser(data) { return this.request('auth.php?action=admin_update_user', 'POST', data); }
}

// MAIN APP
class FichajeApp {
    constructor() {
        this.api = new ApiService();
        this.currentUser = null;
        this.fichajes = [];
        this.users = [];
        this.companies = []; // Companies list
        this.filteredUsers = []; // For admin search
        this.selectedUsers = new Set(); // For admin bulk actions
        this.isLoadingAdminData = false; // Loading guard
        this.currentView = 'login';
        this.currentMonth = new Date();
        this.signaturePad = null;
        this.entrySignaturePad = null;
        this.exitSignaturePad = null;
        window.app = this; // Expose for admin onclick handlers
        this.registerServiceWorker();
        this.init();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(r => console.log('SW registered'))
                    .catch(e => console.log('SW failed', e));
            });
        }
    }

    async init() {
        this.setupEventListeners();
        this.initMainSignaturePad();
        this.initDailySignaturePads();

        const session = await this.api.checkSession();
        if (session.success) {
            this.currentUser = session.user;
            await this.loadData();
            this.showApp();
            this.renderCalendar();
            this.loadTodayFichajes();
            this.updateTabIndicator();
            this.updateCurrentDate();
        } else {
            this.showScreen('login');
        }
    }

    async loadData() {
        const result = await this.api.getFichajes();
        if (result.success) {
            this.fichajes = result.fichajes;
        }
    }

    setupEventListeners() {
        const safeAdd = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        };

        safeAdd('loginForm', 'submit', (e) => this.handleLogin(e));
        safeAdd('registerForm', 'submit', (e) => this.handleRegister(e));
        safeAdd('changePasswordForm', 'submit', (e) => this.handleChangePassword(e));
        safeAdd('showRegisterBtn', 'click', () => this.showScreen('register'));
        safeAdd('backToLoginBtn', 'click', () => this.showScreen('login'));
        safeAdd('logoutBtn', 'click', () => this.handleLogout());

        safeAdd('registerFichajeBtn', 'click', () => this.registerFichaje());
        safeAdd('clearEntrySig', 'click', () => this.clearDailyPad('entry'));
        safeAdd('clearExitSig', 'click', () => this.clearDailyPad('exit'));

        safeAdd('prevMonthBtn', 'click', () => this.changeMonth(-1));
        safeAdd('nextMonthBtn', 'click', () => this.changeMonth(1));

        safeAdd('clearSignatureBtn', 'click', () => this.clearMainSignature());
        safeAdd('generatePdfBtn', 'click', () => this.generatePDF());
        safeAdd('sharePdfBtn', 'click', () => this.sharePDF());

        safeAdd('settingsForm', 'submit', (e) => this.handleSaveSettings(e));
        safeAdd('adminPasswordForm', 'submit', (e) => this.handleAdminPasswordChange(e));

        // Simple Tab Switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.getAttribute('data-tab');
                if (tab) this.switchTab(tab);
            });
        });

        window.addEventListener('resize', () => this.updateTabIndicator());
    }

    openMoreMenu() {
        const moreMenu = document.getElementById('moreMenu');
        const backdrop = document.querySelector('.more-menu-backdrop');
        if (moreMenu && backdrop) {
            moreMenu.classList.add('active');
            backdrop.style.opacity = '1';
            backdrop.style.pointerEvents = 'all';
            document.body.classList.add('menu-open');
        }
    }

    closeMoreMenu() {
        const moreMenu = document.getElementById('moreMenu');
        const backdrop = document.querySelector('.more-menu-backdrop');
        if (moreMenu && backdrop) {
            moreMenu.classList.remove('active');
            backdrop.style.opacity = '0';
            backdrop.style.pointerEvents = 'none';
            document.body.classList.remove('menu-open');
        }
    }

    updateTabIndicator() {
        const activeBtn = document.querySelector('.tab-btn.active');
        const indicator = document.getElementById('tabIndicator');
        const container = document.querySelector('.tabs-container');

        if (!activeBtn || !indicator || !container) return;
        if (getComputedStyle(activeBtn).display === 'none') return;

        const btnRect = activeBtn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        indicator.style.left = `${btnRect.left - containerRect.left}px`;
        indicator.style.width = `${btnRect.width}px`;
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const result = await this.api.login(email, password);

        if (result.success) {
            this.currentUser = result.user;

            if (this.currentUser.forcePasswordChange) {
                this.showScreen('changePassword');
                this.showToast('Por seguridad, debes cambiar tu contraseña');
                return;
            }

            await this.loadData();
            this.showApp();
            this.showToast('Bienvenido, ' + (this.currentUser.nombre || 'Usuario'));
            this.loadTodayFichajes();
            this.renderCalendar();
            if ((this.currentUser.role || '').toLowerCase() === 'admin') {
                document.getElementById('adminTabBtn').style.display = 'flex';
            }
        } else {
            this.showToast(result.message || 'Error de login', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const data = {
            nombre: this.sanitizeInput(document.getElementById('regNombre').value),
            apellidos: this.sanitizeInput(document.getElementById('regApellidos').value),
            dni: this.sanitizeInput(document.getElementById('regDNI').value),
            email: this.sanitizeInput(document.getElementById('regEmail').value),
            password: document.getElementById('regPassword').value,
            afiliacion: this.sanitizeInput(document.getElementById('regAfiliacion').value)
        };

        if (document.getElementById('regPassword').value !== document.getElementById('regPasswordConfirm').value) {
            this.showToast('Las contraseñas no coinciden', 'error');
            return;
        }

        const result = await this.api.register(data);
        if (result.success) {
            this.currentUser = result.user;
            this.showToast('Registro exitoso', 'success');
            this.showScreen('app');
        } else {
            this.showToast(result.message || 'Error en registro', 'error');
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;

        if (newPassword.length < 6) {
            this.showToast('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        const result = await this.api.request('auth.php?action=change_password', 'POST', { newPassword });

        if (result.success) {
            this.showToast('Contraseña actualizada correctamente');
            // Update local user object to remove flag
            this.currentUser = result.user;
            // Proceed to App
            await this.loadData();
            this.showApp();
            this.renderCalendar();
            this.loadTodayFichajes();
            if ((this.currentUser.role || '').toLowerCase() === 'admin') {
                document.getElementById('adminTabBtn').style.display = 'flex';
            }
        } else {
            this.showToast(result.message || 'Error al actualizar', 'error');
        }
    }

    async handleLogout() {
        await this.api.logout();
        this.currentUser = null;
        window.location.reload();
        this.showToast('Sesión cerrada correctamente', 'success');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    }

    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        document.getElementById(`${screenName}Screen`).classList.add('active');
        this.currentView = screenName;
    }

    showApp() {
        this.showScreen('app');
        this.updateUserInfo();

        if ((this.currentUser.role || '').toLowerCase() === 'admin') {
            // Hide employee-only tabs
            const tabsToHide = ['fichaje', 'historico', 'firma'];
            tabsToHide.forEach(tab => {
                const els = document.querySelectorAll(`[data-tab="${tab}"]`);
                els.forEach(el => el.style.setProperty('display', 'none', 'important'));
            });

            const settingsBtn = document.getElementById('settingsTabBtn');
            if (settingsBtn) settingsBtn.style.setProperty('display', 'none', 'important');

            // Show admin tabs
            const adminTab = document.getElementById('adminTabBtn');
            if (adminTab) adminTab.style.display = 'flex';
            const statsTab = document.getElementById('estadisticasTabBtn');
            if (statsTab) statsTab.style.display = 'flex';
            const adminSettingsTab = document.getElementById('adminSettingsTabBtn');
            if (adminSettingsTab) adminSettingsTab.style.display = 'flex';

            this.switchTab('admin');
        } else {
            // Show employee tabs
            document.querySelector('[data-tab="fichaje"]').style.display = 'flex';
            document.querySelector('[data-tab="historico"]').style.display = 'flex';
            document.querySelector('[data-tab="firma"]').style.display = 'flex';

            const settingsBtn = document.getElementById('settingsTabBtn');
            if (settingsBtn) settingsBtn.style.display = 'flex';

            // Hide admin tabs
            const adminTab = document.getElementById('adminTabBtn');
            if (adminTab) adminTab.style.display = 'none';
            const statsTab = document.getElementById('estadisticasTabBtn');
            if (statsTab) statsTab.style.display = 'none';
            const adminSettingsTab = document.getElementById('adminSettingsTabBtn');
            if (adminSettingsTab) adminSettingsTab.style.display = 'none';

            this.switchTab('fichaje');
        }

        this.setupInactivityMonitor();
        this.updateCurrentDate();
        setTimeout(() => this.updateTabIndicator(), 50);
    }

    updateUserInfo() {
        if (!this.currentUser) return;

        // Handle potential key mismatch or missing data
        const nombre = this.currentUser.nombre || this.currentUser.name || 'Usuario';
        const apellidos = this.currentUser.apellidos || '';
        const initials = ((nombre[0] || '?') + (apellidos[0] || '')).toUpperCase();

        const avatarEl = document.querySelector('.user-avatar');
        if (avatarEl) {
            avatarEl.innerHTML = '';

            if (this.currentUser.photo && this.currentUser.photo.startsWith('data:')) {
                const img = document.createElement('img');
                img.src = this.currentUser.photo;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                avatarEl.appendChild(img);
            } else {
                const span = document.createElement('span');
                span.id = 'userInitials';
                span.textContent = initials;
                avatarEl.appendChild(span);
            }
        }

        document.getElementById('userName').textContent = `${nombre} ${apellidos}`;
        document.getElementById('userRole').textContent = (this.currentUser.role || '').toLowerCase() === 'admin' ? 'Administrador' : 'Empleado';
    }

    async loadDashboardData() {
        if (!this.currentUser) return;

        const result = await this.api.request('stats.php?action=dashboard');

        if (result.success && result.stats) {
            const s = result.stats;
            if (document.getElementById('monthHours')) document.getElementById('monthHours').textContent = `${s.monthHours}h`;
            if (document.getElementById('avgDaily')) document.getElementById('avgDaily').textContent = `${s.avgDaily}h`;
            if (document.getElementById('daysWorked')) document.getElementById('daysWorked').textContent = s.daysWorked;
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn, .more-menu-item').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll(`[data-tab="${tabName}"]`).forEach(btn => btn.classList.add('active'));

        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const tabContent = document.getElementById(`${tabName}Tab`);
        if (tabContent) tabContent.classList.add('active');
        this.updateTabIndicator();
        if (tabName === 'fichaje') this.loadTodayFichajes();
        else if (tabName === 'historico') this.renderCalendar();
        else if (tabName === 'admin') this.loadAdminData();
        else if (tabName === 'dashboard') this.loadDashboardData();
        else if (tabName === 'settings') this.loadSettingsForm();
        else if (tabName === 'adminSettings') this.loadAdminSettings();
    }

    registerFichaje() {
        if (!this.currentUser) return;
        const dateInput = document.getElementById('fichajeDate');
        const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
        const entryTime = document.getElementById('entryTime').value;
        const exitTime = document.getElementById('exitTime').value;

        if (!entryTime) {
            this.showToast('Debes indicar al menos la hora de entrada', 'error');
            return;
        }

        const userId = this.currentUser.id || this.currentUser.email;
        const dailyFichajes = this.fichajes.filter(f => f.userId === userId && f.date === date);

        // Sort by time
        dailyFichajes.sort((a, b) => (a.entryTime > b.entryTime ? 1 : -1));

        if (dailyFichajes.length > 0) {
            const lastFichaje = dailyFichajes[dailyFichajes.length - 1];

            // AUTO-ADD AFTERNOON SHIFT LOGIC
            // If creating a 2nd shift (max 2), and previous is closed, and new time is later...
            // Just add it directly without asking to "replace".
            if (dailyFichajes.length < 2 && lastFichaje.exitTime && entryTime > lastFichaje.exitTime) {
                // Turno de tarde detectado -> Añadir directo
                this.processFichaje(date, entryTime, exitTime);
                return;
            }

            // Otherwise (overlap or max shifts), ask confirmation
            this.showCustomModal({
                title: 'Fichaje Existente',
                message: 'Ya hay registros para este día que coinciden. ¿Quieres sobrescribir el registro existente?',
                confirmText: 'Sobrescribir',
                icon: 'warning'
            }).then(confirmed => {
                if (confirmed) {
                    const existingIndex = this.fichajes.findIndex(f => f.userId === userId && f.date === date);
                    this.processFichaje(date, entryTime, exitTime, existingIndex);
                }
            });
            return;
        }

        this.processFichaje(date, entryTime, exitTime);
    }

    async processFichaje(date, entryTime, exitTime, existingIndex = -1) {
        let entrySigData = null;
        let exitSigData = null;

        if (!this.entrySignaturePad.isEmpty()) {
            const uploadRes = await this.api.uploadSignature(this.entrySignaturePad.toDataURL());
            if (uploadRes.success) entrySigData = uploadRes.view_url;
        } else if (existingIndex !== -1) {
            entrySigData = this.fichajes[existingIndex].entrySignature;
        }

        if (!this.exitSignaturePad.isEmpty()) {
            const uploadRes = await this.api.uploadSignature(this.exitSignaturePad.toDataURL());
            if (uploadRes.success) exitSigData = uploadRes.view_url;
        } else if (existingIndex !== -1) {
            exitSigData = this.fichajes[existingIndex].exitSignature;
        }

        const fichaje = {
            userId: this.currentUser.id,
            userName: `${this.currentUser.nombre} ${this.currentUser.apellidos}`,
            date, entryTime, exitTime, entrySignature: entrySigData, exitSignature: exitSigData
        };

        const result = await this.api.saveFichaje(fichaje);
        if (result.success) {
            const wasUpdate = existingIndex !== -1;
            this.showToast(wasUpdate ? 'Fichaje actualizado' : 'Fichaje registrado');
            await this.loadData();
            this.loadTodayFichajes();
            this.clearForm();
        } else {
            this.showToast('Error guardando fichaje', 'error');
        }
    }

    showConfirmModal(onConfirm) {
        const modal = document.getElementById('confirmModal');
        const confirmBtn = document.getElementById('confirmReplace');
        const cancelBtn = document.getElementById('cancelReplace');
        modal.classList.add('show');
        const cleanup = () => {
            modal.classList.remove('show');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        };
        confirmBtn.onclick = () => { onConfirm(); cleanup(); };
        cancelBtn.onclick = () => { cleanup(); };
    }

    clearForm() {
        // Preserve the currently selected date
        const dateInput = document.getElementById('fichajeDate');
        const selectedDate = dateInput ? dateInput.value : null;

        document.getElementById('entryTime').value = '';
        document.getElementById('exitTime').value = '';
        this.clearDailyPad('entry');
        this.clearDailyPad('exit');

        // Load fichajes for the selected date (not today)
        this.loadSelectedDateFichajes();
    }

    loadTodayFichajes() {
        // Initialize date to today only if not already set
        const dateInput = document.getElementById('fichajeDate');
        if (dateInput && !dateInput.value) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            dateInput.max = today; // Prevent future dates
        }
        this.loadSelectedDateFichajes();
    }

    loadSelectedDateFichajes() {
        const dateInput = document.getElementById('fichajeDate');
        const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
        const userId = this.currentUser.id || this.currentUser.email;
        const dateFichajes = this.fichajes.filter(f => f.date === selectedDate && f.userId === userId);
        const listContainer = document.getElementById('todayList');
        if (!listContainer) return;

        if (dateFichajes.length === 0) {
            listContainer.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">No hay fichajes registrados para esta fecha</p>';
            return;
        }

        // Sort by shift number
        dateFichajes.sort((a, b) => (a.shift || 1) - (b.shift || 1));

        listContainer.innerHTML = dateFichajes.map(f => `
            <div class="fichaje-item">
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px; color: var(--accent-primary);">
                        ${f.shift === 2 ? 'Turno 2 (Tarde)' : 'Turno 1 (Mañana)'}
                    </div>
                    <div class="fichaje-time">Entrada: ${f.entryTime}</div>
                    <div class="fichaje-time">Salida: ${f.exitTime || '-'}</div>
                </div>
            </div>
        `).join('');
    }

    updateCurrentDate() {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('fichajeDate');
        if (dateInput) {
            // Only set to today if no date is currently selected
            if (!dateInput.value) {
                dateInput.value = today;
            }
            dateInput.max = today; // Prevent future dates
        }
    }

    changeMonth(direction) {
        this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + direction, 1);
        this.renderCalendar();
    }

    renderCalendar() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        const daysInMonth = lastDay.getDate();
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';

        // Calculate Stats
        const userId = this.currentUser.id || this.currentUser.email;
        const monthFichajes = this.fichajes.filter(f => {
            const d = new Date(f.date);
            return f.userId === userId && d.getMonth() === month && d.getFullYear() === year;
        });



        const dayHeaders = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-day header';
            header.textContent = day;
            grid.appendChild(header);
        });

        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day other-month';
            grid.appendChild(emptyDay);
        }

        const today = new Date();


        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            const currentDate = new Date(year, month, day);
            const dateString = currentDate.toISOString().split('T')[0];
            const dayOfWeek = currentDate.getDay();

            if (dateString === today.toISOString().split('T')[0]) dayElement.classList.add('today');
            if (currentDate > today) dayElement.classList.add('future');

            const hasFichaje = this.fichajes.some(f => f.date === dateString && f.userId === userId);
            const isPast = currentDate < today && dateString !== today.toISOString().split('T')[0];

            // Show missing indicator for past days without fichaje (including weekends)
            if (isPast && !hasFichaje) dayElement.classList.add('missing');
            else if (hasFichaje) dayElement.classList.add('complete');

            // Show indicator for all days with fichaje or missing fichaje
            dayElement.innerHTML = `<span class="day-number">${day}</span>${(hasFichaje || isPast) ? '<span class="day-indicator"></span>' : ''}`;
            grid.appendChild(dayElement);
        }
    }

    initMainSignaturePad() { this.signaturePad = this.setupCanvas('signaturePad'); }
    initDailySignaturePads() {
        this.entrySignaturePad = this.setupCanvas('entrySigPad');
        this.exitSignaturePad = this.setupCanvas('exitSigPad');
    }

    setupCanvas(elementId) {
        const canvas = document.getElementById(elementId);
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let lastX = 0, lastY = 0;

        // Robust High-DPI scaling using ResizeObserver
        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            // Only resize if visible and has dimensions
            if (rect.width === 0 || rect.height === 0) return;

            const dpr = window.devicePixelRatio || 2;

            // Store current content? (Simpler: just reset, assuming empty on init/resize)
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            ctx.scale(dpr, dpr);

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            ctx.scale(dpr, dpr);

            // Do NOT set canvas.style.width/height here
            // Let CSS (width: 100%; height: 100%) handle the display size
            // This ensures it fills the container perfectly even if container resizes dynamically

            // Restore context styles
            ctx.strokeStyle = '#0033CC';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };

        // Observe size changes (handles visibility toggle and window resize)
        const observer = new ResizeObserver(() => resizeCanvas());
        observer.observe(canvas);

        // Initial check (in case already visible)
        resizeCanvas();

        const getCoords = (e) => {
            const rect = canvas.getBoundingClientRect();
            // Use CSS dimensions (rect.width/height) not canvas.width/height which are DPI-scaled
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const startDrawing = (e) => { isDrawing = true; const coords = getCoords(e); lastX = coords.x; lastY = coords.y; };
        const draw = (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            const coords = getCoords(e);
            ctx.strokeStyle = '#0033CC'; /* Dark Blue Ink */
            ctx.lineWidth = 2.5; /* Slightly thicker for better visibility */
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            lastX = coords.x; lastY = coords.y;
        };
        const stopDrawing = () => { isDrawing = false; };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        return { canvas, ctx, isEmpty: () => this.isCanvasEmpty(canvas), toDataURL: (type) => canvas.toDataURL(type) };
    }

    clearMainSignature() { this.clearCanvas(this.signaturePad); }
    clearDailyPad(type) {
        if (type === 'entry') this.clearCanvas(this.entrySignaturePad);
        if (type === 'exit') this.clearCanvas(this.exitSignaturePad);
    }
    clearCanvas(pad) { if (pad && pad.ctx) pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height); }
    isCanvasEmpty(canvas) {
        const blank = document.createElement('canvas');
        blank.width = canvas.width; blank.height = canvas.height;
        return canvas.toDataURL() === blank.toDataURL();
    }
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    setupInactivityMonitor() {
        const resetTimer = () => {
            if (this.currentUser) {
                clearTimeout(this.inactivityTimer);
                this.inactivityTimer = setTimeout(() => {
                    this.showToast('Sesión cerrada por inactividad', 'error');
                    this.handleLogout();
                }, 5 * 60 * 1000); // 5 minutes of inactivity
            }
        };
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('touchstart', resetTimer);
        window.addEventListener('click', resetTimer);
    }
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.className = 'toast', 3000);
    }

    showCustomModal({ title, message, icon = 'warning', confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false }) {
        return new Promise((resolve) => {
            const modal = document.getElementById('customConfirmModal');
            const modalTitle = document.getElementById('customModalTitle');
            const modalBody = document.getElementById('customModalBody');
            const modalIcon = document.getElementById('customModalIcon');
            const confirmBtn = document.getElementById('customModalConfirm');
            const cancelBtn = document.getElementById('customModalCancel');

            // Set content
            modalTitle.textContent = title;
            modalBody.textContent = message;

            // Set icon
            modalIcon.className = `custom-modal-icon ${icon}`;
            modalIcon.textContent = icon === 'danger' ? '🗑️' : '⚠️';

            // Set button text
            confirmBtn.textContent = confirmText;
            cancelBtn.textContent = cancelText;

            // Set button style
            if (isDanger) {
                confirmBtn.classList.add('danger');
            } else {
                confirmBtn.classList.remove('danger');
            }

            // Show modal
            modal.classList.add('show');

            // Handle confirm
            const handleConfirm = () => {
                modal.classList.remove('show');
                cleanup();
                resolve(true);
            };

            // Handle cancel
            const handleCancel = () => {
                modal.classList.remove('show');
                cleanup();
                resolve(false);
            };

            // Cleanup listeners
            const cleanup = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                modal.querySelector('.custom-modal-backdrop').removeEventListener('click', handleCancel);
            };

            // Add listeners
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            modal.querySelector('.custom-modal-backdrop').addEventListener('click', handleCancel);
        });
    }

    async generatePDF() {
        const userId = this.currentUser.id || this.currentUser.email;
        // Capture current signature pad state if valid
        if (this.signaturePad && !this.isCanvasEmpty(this.signaturePad.canvas)) {
            const upload = await this.api.uploadSignature(this.signaturePad.canvas.toDataURL('image/png'));
            if (upload.success) this.currentUser.mainSignature = upload.view_url;
        }

        const userFichajes = this.fichajes.filter(f => f.userId === userId);

        // Use the shared preloader, but we need to handle mainSignature locally first
        // actually _prepareAndDownloadPdf handles the heavy lifting of images.
        // We just need to pass the user with the mainSignature attached.

        this._prepareAndDownloadPdf(this.currentUser, userFichajes);
    }

    // ==========================================
    // PDF GENERATION (pdfmake) - Custom Template
    // ==========================================

    _createAndDownloadPdf(user, fichajes, companyProfile = null) {
        if (!window.pdfMake) {
            this.showToast('Error: pdfmake no está cargado', 'error');
            return;
        }

        // IMPORTANT: Bind VFS fonts
        if (window.pdfMake.vfs) {
            window.pdfMake.vfs = window.pdfMake.vfs;
        }

        // Use the selected month from the app state (Historico tab)
        const currentDate = new Date(this.currentMonth);
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Month names in Spanish
        const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const monthName = monthNames[currentMonth];

        // Last day of current month
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // Company Data
        const companyName = companyProfile ? companyProfile.name : 'ALBALUZ DESARROLLOS URBANOS, S.A.';
        const companyCif = companyProfile ? companyProfile.cif : 'A98543432';
        const companyAddress = companyProfile ? (companyProfile.address || companyName) : 'ALBALUZ DESARROLLOS URBANOS S.A';
        const companyCCC = companyProfile ? companyProfile.ccc : '02/1089856/19';

        // 1. Header Table Data
        const headerTableBody = [
            [
                { text: 'Empresa:', bold: true, style: 'headerLabel' },
                { text: companyName, style: 'headerValue' },
                { text: 'Trabajador:', bold: true, style: 'headerLabel' },
                { text: `${user.nombre} ${user.apellidos}`.toUpperCase(), style: 'headerValue' }
            ],
            [
                { text: 'C.I.F./N.I.F.:', bold: true, style: 'headerLabel' },
                { text: companyCif, style: 'headerValue' },
                { text: 'N.I.F.:', bold: true, style: 'headerLabel' },
                { text: (user.dni || '').toUpperCase(), style: 'headerValue' }
            ],
            [
                { text: 'Centro de Trabajo:', bold: true, style: 'headerLabel' },
                { text: companyAddress, style: 'headerValue' },
                { text: 'Nº Afiliación:', bold: true, style: 'headerLabel' },
                { text: user.afiliacion || '', style: 'headerValue' }
            ],
            [
                { text: 'C.C.C.:', bold: true, style: 'headerLabel' },
                { text: companyCCC, style: 'headerValue' },
                { text: 'Mes y Año:', bold: true, style: 'headerLabel' },
                { text: `${(currentMonth + 1).toString().padStart(2, '0')}/${currentYear}`, style: 'headerValue' }
            ]
        ];

        // 2. Main Grid Data - DUAL SHIFTS
        const gridHeaderRows = [
            [
                { text: 'DIA', style: 'tableHeader', alignment: 'center', margin: [0, 2, 0, 0] },
                { text: 'HORA ENTRADA', style: 'tableHeader', colSpan: 2, alignment: 'center', margin: [0, 2, 0, 0] },
                {},
                { text: 'HORA SALIDA', style: 'tableHeader', colSpan: 2, alignment: 'center', margin: [0, 2, 0, 0] },
                {},
                { text: 'HORAS TOTALES', style: 'tableHeader', alignment: 'center', margin: [0, 2, 0, 0] },
                { text: 'FIRMAS ENTRADA', style: 'tableHeader', colSpan: 2, alignment: 'center', margin: [0, 2, 0, 0] },
                {},
                { text: 'FIRMAS SALIDA', style: 'tableHeader', colSpan: 2, alignment: 'center', margin: [0, 2, 0, 0] },
                {}
            ]
        ];

        const gridBody = [...gridHeaderRows];
        let totalHorasMensuales = 0;

        // Generate rows 1 to 31
        for (let day = 1; day <= 31; day++) {
            // ... existing loop code ...
            // BUT I am replacing the method so I need to copy the loop content.
            // This replacement is partial? No, I need to provide full content for the replacement range.
            // The Range is 777 to 1008.
            // I must include the loop.
            const checkDate = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const dayFichajes = fichajes.filter(f => f.date === checkDate);
            const shift1 = dayFichajes.find(f => f.shift === 1) || {};
            const shift2 = dayFichajes.find(f => f.shift === 2) || {};

            let entry1 = shift1.entryTime || '';
            let exit1 = shift1.exitTime || '';
            let entry2 = shift2.entryTime || '';
            let exit2 = shift2.exitTime || '';
            let totalHours = '';

            let hours1 = 0;
            if (entry1 && exit1) {
                const start = new Date(`2000-01-01T${entry1}`);
                const end = new Date(`2000-01-01T${exit1}`);
                if (end > start) hours1 = (end - start) / 3600000;
            }

            let hours2 = 0;
            if (entry2 && exit2) {
                const start = new Date(`2000-01-01T${entry2}`);
                const end = new Date(`2000-01-01T${exit2}`);
                if (end > start) hours2 = (end - start) / 3600000;
            }

            const dayTotal = hours1 + hours2;
            if (dayTotal > 0) {
                totalHorasMensuales += dayTotal;
                totalHours = dayTotal.toFixed(2);
            }

            let entry1Sig = '';
            let exit1Sig = '';
            let entry2Sig = '';
            let exit2Sig = '';

            if (shift1.entrySignature) entry1Sig = { image: shift1.entrySignature, width: 20, alignment: 'center', margin: [0, 1, 0, 0] };
            if (shift1.exitSignature) exit1Sig = { image: shift1.exitSignature, width: 20, alignment: 'center', margin: [0, 1, 0, 0] };
            if (shift2.entrySignature) entry2Sig = { image: shift2.entrySignature, width: 20, alignment: 'center', margin: [0, 1, 0, 0] };
            if (shift2.exitSignature) exit2Sig = { image: shift2.exitSignature, width: 20, alignment: 'center', margin: [0, 1, 0, 0] };

            gridBody.push([
                { text: day.toString(), alignment: 'center', style: 'tableCell' },
                { text: entry1, alignment: 'center', style: 'tableCell' },
                { text: entry2, alignment: 'center', style: 'tableCell' },
                { text: exit1, alignment: 'center', style: 'tableCell' },
                { text: exit2, alignment: 'center', style: 'tableCell' },
                { text: totalHours, alignment: 'center', style: 'tableCell' },
                entry1Sig,
                entry2Sig,
                exit1Sig,
                exit2Sig
            ]);
        }

        // Total Row
        gridBody.push([
            { text: 'TOTAL\nHORAS', colSpan: 1, style: 'tableTotal', alignment: 'center' },
            { text: '', colSpan: 4, style: 'tableTotal' },
            {},
            {},
            {},
            { text: totalHorasMensuales > 0 ? totalHorasMensuales.toFixed(2) : '', alignment: 'center', style: 'tableTotal' },
            { text: '', colSpan: 4, style: 'tableTotal' },
            {},
            {},
            {}
        ]);

        // Signatures Logic
        let employeeSignatureImg = { text: '\n', height: 40 }; // Placeholder
        if (user.mainSignature) {
            employeeSignatureImg = { image: user.mainSignature, fit: [150, 50], alignment: 'center', margin: [0, 5, 0, 0] };
        } else if (this.signaturePad && !this.isCanvasEmpty(this.signaturePad.canvas) && user.id === (this.currentUser.id || this.currentUser.email)) {
            employeeSignatureImg = { image: this.signaturePad.canvas.toDataURL('image/png'), fit: [150, 50], alignment: 'center', margin: [0, 5, 0, 0] };
        }

        // Company Seal Logic
        let companySignatureImg = { text: '\n', height: 40 };
        if (companyProfile && companyProfile.sealImage) {
            companySignatureImg = { image: companyProfile.sealImage, fit: [150, 50], alignment: 'center', margin: [0, 5, 0, 0] };
        }

        // Document Definition
        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [20, 10, 20, 5], // Slightly more top margin
            content: [
                { text: 'Listado Resumen mensual del registro de jornada (completo)', style: 'mainHeader' },
                {
                    style: 'headerTable',
                    table: {
                        widths: ['15%', '35%', '15%', '35%'],
                        body: headerTableBody
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 0.5; },
                        vLineWidth: function (i, node) { return 0.5; },
                    }
                },
                { text: '', margin: [0, 5] },
                {
                    style: 'mainGrid',
                    table: {
                        headerRows: 1,
                        widths: ['10%', '10.5%', '10.5%', '10.5%', '10.5%', '11%', '9.5%', '9.5%', '9.5%', '9.5%'],
                        body: gridBody
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 0.5; },
                        vLineWidth: function (i, node) { return 0.5; },
                        fillColor: function (rowIndex, node, columnIndex) {
                            return (rowIndex < 1) ? '#eeeeee' : null;
                        }
                    }
                },
                { text: '', margin: [0, 5] },
                {
                    style: 'signatureTable',
                    table: {
                        widths: ['50%', '50%'],
                        heights: [15, 60], // Row 1: label height, Row 2: image box height
                        body: [
                            [
                                { text: 'Firma de la empresa:', style: 'signatureLabel', alignment: 'left', border: [false, false, false, false], color: 'black' },
                                { text: 'Firma del trabajador:', style: 'signatureLabel', alignment: 'left', border: [false, false, false, false], color: 'black' }
                            ],
                            [
                                {
                                    stack: [companySignatureImg],
                                    border: [false, false, false, false],
                                    alignment: 'left'
                                },
                                {
                                    stack: [employeeSignatureImg],
                                    border: [false, false, false, false],
                                    alignment: 'left'
                                }
                            ]
                        ]
                    },
                    layout: {
                        defaultBorder: false,
                    },
                    margin: [0, 5, 0, 0], // Reduced margin from 10 to 5
                    unbreakable: true
                },
                { text: '', margin: [0, 0] },
                {
                    text: [
                        { text: 'En ' },
                        { text: (companyProfile && companyProfile.address ? companyProfile.address.split(',')[0].toUpperCase() : 'ALBACETE'), decoration: 'underline' },
                        { text: ', a ' },
                        { text: lastDayOfMonth.toString(), decoration: 'underline' },
                        { text: ' de ' },
                        { text: monthName.toUpperCase(), decoration: 'underline' },
                        { text: ' de ' },
                        { text: currentYear.toString(), decoration: 'underline' }
                    ],
                    alignment: 'right',
                    margin: [0, 5, 0, 5], // Reduced margin from [0, 20, 0, 10] to [0, 5, 0, 5]
                    fontSize: 12 // Slightly smaller font
                },
                {
                    text: 'Registro realizado en cumplimiento de la letra h) del artículo 1 del R.D.-Ley 16/2013, de 20 de diciembre por el que se modifica el artículo 12.5 del E.T., por el que se establece que "La jornada de los trabajadores a tiempo parcial se registrará día a día y se totalizará mensualmente, entregando copia al trabajador, junto con el recibo de salarios, del resumen de todas las horas realizadas en cada mes, tanto de las ordinarias como de las complementarias en sus distintas modalidades.\n\nEl empresario deberá conservar los resúmenes mensuales de los registros de jornada durante un periodo mínimo de cuatro años. El incumplimiento empresarial de estas obligaciones de registro tendrá por consecuencia jurídica la de que el contrato se presuma celebrado a jornada completa, salvo prueba en contrario que acredite el carácter parcial de los servicios.',
                    style: 'legalText',
                    margin: [0, 5, 0, 0] // Reduced margin from 8 to 5
                }
            ],
            styles: {
                mainHeader: { fontSize: 13, bold: true, alignment: 'center', margin: [0, 0, 0, 8] },
                headerTable: { margin: [0, 0, 0, 0] },
                headerLabel: { fontSize: 8, bold: false, color: '#000000', fillColor: '#eeeeee' },
                headerValue: { fontSize: 9, bold: true },
                tableHeader: { fontSize: 8, bold: true, color: 'black', fillColor: '#eeeeee' },
                tableSubHeader: { fontSize: 8, bold: true, color: 'black', fillColor: '#eeeeee' },
                tableCell: { fontSize: 8, margin: [0, 1, 0, 1] },
                tableTotal: { fontSize: 9, bold: true, fillColor: '#eeeeee' },
                signatureLabel: { fontSize: 10, bold: true },
                legalText: { fontSize: 5, alignment: 'justify', color: '#444444' }
            }
        };

        try {
            const pdf = pdfMake.createPdf(docDefinition);
            const monthNumber = (currentMonth + 1).toString().padStart(2, '0');
            const monthName = monthNames[currentMonth].toUpperCase();
            const dni = user.dni || 'SIN_DNI';
            const filename = `FICHAJE_MENSUAL_${dni}_${monthName}_${currentYear}.pdf`;
            console.log('Generating PDF with filename:', filename);

            // Force download using Blob to ensure filename is respected on Android/Mobile
            pdf.getBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();

                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            });

            this.showToast('PDF Generado', 'success');
        } catch (e) {
            console.error(e);
            this.showToast('Error generando PDF: ' + e.message, 'error');
        }
    }

    // Admin Implementation
    async loadAdminData() {
        if (!this.currentUser || (this.currentUser.role || '').toLowerCase() !== 'admin') return;
        if (this.isLoadingAdminData) return;

        this.isLoadingAdminData = true;

        try {
            // Show skeleton loading only if we don't have data yet
            // This prevents "flashing" or disappearing content on updates
            if (this.users.length === 0) {
                this.renderSkeleton();
            }

            // Fetch fresh data
            console.log('Fetching admin data...');
            const [usersRes, fichajesRes] = await Promise.all([
                this.api.getAllUsers(),
                this.api.getAllFichajes()
            ]);

            console.log('Users Response:', usersRes);
            console.log('Fichajes Response:', fichajesRes);

            if (usersRes.success) {
                this.users = usersRes.users;
                this.filteredUsers = [...this.users]; // For search
                this.selectedUsers = new Set(); // For bulk actions
            } else {
                this.showToast('Error cargando usuarios: ' + (usersRes.message || 'Error desconocido'), 'error');
            }

            if (fichajesRes.success) {
                this.fichajes = fichajesRes.fichajes;
            } else {
                this.showToast('Error cargando fichajes: ' + (fichajesRes.message || 'Error desconocido'), 'error');
            }

            // Update stats
            const totalEmployees = this.users.length;
            const today = new Date().toISOString().split('T')[0];
            const todayFichajesCount = this.fichajes.filter(f => f.date === today).length;

            const elTotal = document.getElementById('totalEmployees');
            const elToday = document.getElementById('todayFichajes');
            if (elTotal) elTotal.textContent = totalEmployees;
            if (elToday) elToday.textContent = todayFichajesCount;

            // Render list
            console.log('Calling renderEmployeeList with users:', this.users.length);
            this.renderEmployeeList();

            // Setup toolbars only once or update them
            this.setupSearch();
            this.setupSorting();
            this.setupBulkActions();

        } catch (error) {
            console.error('Error in loadAdminData:', error);
            this.showToast('Error al procesar datos de administración', 'error');
            // Try to render what we have
            this.renderEmployeeList();
        } finally {
            this.isLoadingAdminData = false;
        }
    }

    renderSkeleton() {
        const list = document.getElementById('employeeList');
        const skeletonHTML = `
            <div class="skeleton-container">
                ${Array(5).fill(0).map(() => `
                    <div class="skeleton-row">
                        <div class="skeleton-avatar"></div>
                        <div class="skeleton-text">
                            <div class="skeleton-line"></div>
                            <div class="skeleton-line short"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        list.innerHTML = skeletonHTML;
    }

    renderEmployeeList(usersToRender = null) {
        const users = usersToRender || this.filteredUsers || this.users;
        console.log(`[DEBUG] renderEmployeeList called. Users to render: ${users ? users.length : 'null'}`);
        const list = document.getElementById('employeeList');

        // Generate Table Rows (Desktop)
        const tableRows = users.map((user, index) => {
            try {
                if (!user) return '';

                // Safe access to fichajes
                const userFichajes = (this.fichajes || []).filter(f => f && f.userId === user.id);
                const lastFichaje = userFichajes.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                const isSelected = this.selectedUsers && this.selectedUsers.has(user.id);

                // Safe name generation
                const nombre = user.nombre || 'Sin Nombre';
                const apellidos = user.apellidos || '';
                const email = user.email || 'Sin Email';
                const initials = ((nombre[0] || '?') + (apellidos[0] || '')).toUpperCase();

                return `
                    <tr class="animate-stagger" style="animation-delay: ${index * 0.03}s">
                        <td>
                            <input type="checkbox" class="user-checkbox" data-user-id="${user.id}" ${isSelected ? 'checked' : ''}>
                        </td>
                        <td>
                            <div class="table-user-info">
                                <div class="table-avatar">
                                    ${initials}
                                </div>
                                <div>
                                    <div style="font-weight: 600;">${nombre} ${apellidos}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${email}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div style="font-size: 13px;">${user.dni || '-'}</div>
                        </td>
                        <td>
                            <div style="font-size: 13px;">${lastFichaje ? lastFichaje.date : 'Nunca'}</div>
                        </td>
                        <td>
                            <div class="table-actions">
                                 <button class="table-btn btn-reset" onclick="window.app.showUserEditModal('${user.id}')" title="Editar Usuario" style="background: rgba(255, 159, 10, 0.15); color: #FF9F0A;">
                                    ✏️
                                </button>
                                 <button class="table-btn btn-reset" onclick="window.app.resetUserPassword('${user.id}', '${email}')" title="Resetear Contraseña">
                                    🔑 Reset
                                </button>
                                <button class="table-btn btn-pdf" onclick="window.app.generatePDFForUser('${user.id}')" title="PDF Mes Actual">
                                    📄 Mes
                                </button>
                                <button class="table-btn btn-pdf-hist" onclick="window.app.generateAllPDFsForUser('${user.id}', '${nombre} ${apellidos}')" title="PDFs Históricos">
                                    📦 Historial
                                </button>
                                <button class="table-btn btn-delete" onclick="window.app.deleteUser('${user.id}', '${email}')" title="Borrar Usuario">
                                    🗑️
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            } catch (err) {
                console.error('Error rendering user row:', user, err);
                return '';
            }
        }).join('');

        // Generate Cards (Mobile)
        const mobileCards = users.map((user, index) => {
            try {
                if (!user) return '';

                const userFichajes = (this.fichajes || []).filter(f => f && f.userId === user.id);
                const lastFichaje = userFichajes.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                const isSelected = this.selectedUsers && this.selectedUsers.has(user.id);
                const nombre = user.nombre || 'Sin Nombre';
                const apellidos = user.apellidos || '';
                const email = user.email || 'Sin Email';
                const initials = ((nombre[0] || '?') + (apellidos[0] || '')).toUpperCase();


                return `
                <div class="employee-card animate-stagger" style="animation-delay: ${index * 0.05}s">
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <input type="checkbox" class="user-checkbox" data-user-id="${user.id}" ${isSelected ? 'checked' : ''} style="margin-top: 4px;">
                        <div class="user-avatar" style="width: 40px; height: 40px; font-size: 16px; flex-shrink: 0;">
                            ${initials}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600; color: #fff;">
                                ${nombre} ${apellidos}
                            </h4>
                            <p style="margin: 0 0 4px 0; font-size: 13px; color: var(--text-secondary);">
                                ${email}
                            </p>
                            <p style="margin: 0; font-size: 12px; color: var(--text-tertiary);">
                                DNI: ${user.dni || '-'} • Último: ${lastFichaje ? lastFichaje.date : 'Nunca'}
                            </p>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
                        <button class="download-btn" style="padding: 10px; font-size: 12px; background: rgba(255, 159, 10, 0.15); color: #FF9F0A;" onclick="window.app.showUserEditModal('${user.id}')">
                            ✏️ Editar
                        </button>
                        <button class="download-btn" style="padding: 10px; font-size: 12px;" onclick="window.app.resetUserPassword('${user.id}', '${email}')">
                            🔑 Reset
                        </button>
                        <button class="download-btn" style="padding: 10px; font-size: 12px; background: rgba(255,59,48,0.15);" onclick="window.app.deleteUser('${user.id}', '${email}')">
                            🗑️ Borrar
                        </button>
                        <button class="download-btn" style="padding: 10px; font-size: 12px;" onclick="window.app.generatePDFForUser('${user.id}')">
                            📄 PDF Mes
                        </button>
                        <button class="download-btn" style="padding: 10px; font-size: 12px; background: rgba(52,199,89,0.15);" onclick="window.app.generateAllPDFsForUser('${user.id}', '${nombre} ${apellidos}')">
                            📦 Histórico
                        </button>
                    </div>
                </div>
            `;
            } catch (err) {
                return '';
            }
        }).join('');

        // Combine Views
        list.innerHTML = `
            <!-- Desktop Table View -->
            <div class="desktop-only animate-fade-in">
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th style="width: 40px;"></th>
                                <th class="sortable-header" onclick="window.app.sortUsers('name')">
                                    Empleado <span class="sort-indicator">↕</span>
                                </th>
                                <th class="sortable-header" onclick="window.app.sortUsers('dni')">
                                    DNI <span class="sort-indicator">↕</span>
                                </th>
                                <th class="sortable-header" onclick="window.app.sortUsers('lastFichaje')">
                                    Último Fichaje <span class="sort-indicator">↕</span>
                                </th>
                                <th style="text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Mobile Card View -->
            <div class="mobile-only animate-fade-in">
                ${mobileCards}
            </div>
        `;

        // Add checkbox event listeners
        setTimeout(() => {
            document.querySelectorAll('.user-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const userId = e.target.dataset.userId;
                    if (e.target.checked) {
                        this.selectedUsers.add(userId);
                    } else {
                        this.selectedUsers.delete(userId);
                    }
                    this.updateBulkActionsBar();
                });
            });
        }, 0);
    }

    async resetUserPassword(userId, userEmail) {
        const confirmed = await this.showCustomModal({
            title: 'Resetear Contraseña',
            message: `¿Resetear contraseña de ${userEmail}?\n\nSe generará una contraseña temporal: temp123456`,
            icon: 'warning',
            confirmText: 'Resetear',
            cancelText: 'Cancelar'
        });

        if (!confirmed) return;

        const result = await this.api.request('auth.php?action=admin_reset_password', 'POST', { userId });

        if (result.success) {
            this.showToast(`✅ Contraseña reseteada. Nueva contraseña: temp123456`, 'success');
            alert(`Contraseña temporal para ${userEmail}:\n\ntemp123456\n\nEl usuario deberá cambiarla al iniciar sesión.`);
        } else {
            this.showToast(`❌ Error: ${result.message}`, 'error');
        }
    }

    async deleteUser(userId, userEmail) {
        const confirmed = await this.showCustomModal({
            title: '⚠️ Borrar Usuario',
            message: `¿BORRAR usuario ${userEmail}?\n\nEsta acción NO se puede deshacer.\nSe eliminarán todos sus fichajes.`,
            icon: 'danger',
            confirmText: 'Borrar',
            cancelText: 'Cancelar',
            isDanger: true
        });

        if (!confirmed) return;

        const doubleConfirm = await this.showCustomModal({
            title: 'Confirmación Final',
            message: `¿Estás SEGURO de borrar ${userEmail}?`,
            icon: 'danger',
            confirmText: 'Sí, borrar',
            cancelText: 'No',
            isDanger: true
        });

        if (!doubleConfirm) return;

        const result = await this.api.request('auth.php?action=admin_delete_user', 'POST', { userId });

        if (result.success) {
            this.showToast(`✅ Usuario eliminado`, 'success');
            await this.loadAdminData();
            this.renderEmployeeList();
        } else {
            this.showToast(`❌ Error: ${result.message}`, 'error');
        }
    }

    generatePDFForUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        // Filter fichajes for this user specifically
        const userFichajes = this.fichajes.filter(f => f.userId === userId);

        // We modify the user object to include mainSignature if available in their profile or use a placeholder
        // Since we don't have their live signature pad, we rely on stored signature or their profile 'mainSignature' if kept there.
        // For now, we will just pass the user object.
        this._prepareAndDownloadPdf(user, userFichajes);
    }

    async generateAllPDFsForUser(userId, userName) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const userFichajes = this.fichajes.filter(f => f.userId === userId);

        if (userFichajes.length === 0) {
            this.showToast('❌ No hay fichajes para este usuario', 'error');
            return;
        }

        // Get unique months with data
        const monthsSet = new Set();
        userFichajes.forEach(f => {
            const date = new Date(f.date);
            const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            monthsSet.add(monthKey);
        });

        const months = Array.from(monthsSet).sort();

        this.showToast(`📦 Generando ${months.length} PDFs para ${userName}...`, 'info');

        // Generate PDFs sequentially with delay
        for (let i = 0; i < months.length; i++) {
            const [year, month] = months[i].split('-');
            const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);

            // Filter fichajes for this specific month
            const monthFichajes = userFichajes.filter(f => {
                const fDate = new Date(f.date);
                return fDate.getFullYear() === parseInt(year) &&
                    fDate.getMonth() === parseInt(month) - 1;
            });

            // Temporarily set currentMonth for PDF generation
            const originalMonth = this.currentMonth;
            this.currentMonth = monthDate;

            // Generate PDF
            await this._prepareAndDownloadPdf(user, monthFichajes);

            // Restore original month
            this.currentMonth = originalMonth;

            // Small delay between PDFs
            if (i < months.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        this.showToast(`✅ ${months.length} PDFs generados`, 'success');
    }

    async _prepareAndDownloadPdf(user, userFichajes) {
        this.showToast(`Generando PDF para ${user.nombre}...`);

        const toDataURL = url => {
            const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}/${url}`;
            return fetch(absoluteUrl)
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch');
                    return response.blob();
                })
                .then(blob => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }))
                .catch((err) => {
                    console.warn('Failed to load image:', absoluteUrl, err);
                    return null;
                });
        };

        const processedFichajes = await Promise.all(userFichajes.map(async f => {
            let entrySig = null; let exitSig = null;
            if (f.entrySignature && !f.entrySignature.startsWith('data:')) {
                entrySig = await toDataURL(f.entrySignature);
            } else {
                entrySig = f.entrySignature;
            }

            if (f.exitSignature && !f.exitSignature.startsWith('data:')) {
                exitSig = await toDataURL(f.exitSignature);
            } else {
                exitSig = f.exitSignature;
            }

            return { ...f, entrySignature: entrySig, exitSignature: exitSig };
        }));

        // Handle User Main Signature
        let mainSignatureData = user.mainSignature;
        if (!mainSignatureData || mainSignatureData === '') {
            const fichajesWithExitSig = userFichajes
                .filter(f => f.exitSignature)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            if (fichajesWithExitSig.length > 0) {
                mainSignatureData = fichajesWithExitSig[0].exitSignature;
            }
        }

        if (mainSignatureData && !mainSignatureData.startsWith('data:')) {
            mainSignatureData = await toDataURL(mainSignatureData);
        }

        // Handle Company Profile
        let companyProfile = null;
        if (user.companyProfileId) {
            // Ensure companies are loaded
            if (this.companies.length === 0) {
                try {
                    const res = await this.api.getCompanies();
                    if (res.success) this.companies = res.companies;
                } catch (e) { console.error('Error loading companies for PDF', e); }
            }

            const foundCompany = this.companies.find(c => c.id === user.companyProfileId);
            if (foundCompany) {
                // Process Company Seal
                let sealData = foundCompany.sealImage;
                if (sealData && !sealData.startsWith('data:')) {
                    sealData = await toDataURL(sealData);
                }
                companyProfile = { ...foundCompany, sealImage: sealData };
            }
        }

        const processedUser = { ...user, mainSignature: mainSignatureData };

        this._createAndDownloadPdf(processedUser, processedFichajes, companyProfile);
    }

    async sharePDF() { this.generatePDF(); }

    loadSettingsForm() {
        document.getElementById('settingsNombre').value = this.currentUser.nombre || '';
        document.getElementById('settingsApellidos').value = this.currentUser.apellidos || '';
        document.getElementById('settingsDni').value = this.currentUser.dni || '';
        document.getElementById('settingsAfiliacion').value = this.currentUser.afiliacion || '';
        document.getElementById('settingsEmail').value = this.currentUser.email || '';
    }

    async handleSaveSettings(e) {
        e.preventDefault();

        const updatedData = {
            nombre: document.getElementById('settingsNombre').value.trim(),
            apellidos: document.getElementById('settingsApellidos').value.trim(),
            dni: document.getElementById('settingsDni').value.trim(),
            afiliacion: document.getElementById('settingsAfiliacion').value.trim()
        };

        const result = await this.api.request('auth.php?action=update_profile', 'POST', updatedData);

        if (result.success) {
            this.currentUser = { ...this.currentUser, ...updatedData };
            this.showToast('✅ Datos actualizados correctamente', 'success');
        } else {
            this.showToast(`❌ Error: ${result.message}`, 'error');
        }
    }

    async handleAdminPasswordChange(e) {
        e.preventDefault();

        const newPassword = document.getElementById('adminNewPassword').value;
        const confirmPassword = document.getElementById('adminConfirmPassword').value;

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            this.showToast('❌ Las contraseñas no coinciden', 'error');
            return;
        }

        // Validate minimum length
        if (newPassword.length < 6) {
            this.showToast('❌ La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        const result = await this.api.request('auth.php?action=admin_change_password', 'POST', { newPassword });

        if (result.success) {
            this.showToast('✅ Contraseña actualizada correctamente', 'success');
            // Clear the form
            document.getElementById('adminNewPassword').value = '';
            document.getElementById('adminConfirmPassword').value = '';
        } else {
            this.showToast(`❌ Error: ${result.message}`, 'error');
        }
    }

    setupSearch() {
        const searchInput = document.getElementById('adminSearch');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();

            if (!query) {
                this.filteredUsers = [...this.users];
            } else {
                this.filteredUsers = this.users.filter(user => {
                    const searchText = `${user.nombre} ${user.apellidos} ${user.email} ${user.dni || ''}`.toLowerCase();
                    return searchText.includes(query);
                });
            }

            this.renderEmployeeList();
        });
    }

    setupSorting() {
        // Will add click handlers to table headers
        this.currentSort = { column: null, direction: 'asc' };
    }

    sortUsers(column) {
        // Toggle direction if same column
        if (this.currentSort.column === column) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = column;
            this.currentSort.direction = 'asc';
        }

        const direction = this.currentSort.direction === 'asc' ? 1 : -1;

        this.filteredUsers.sort((a, b) => {
            let aVal, bVal;

            switch (column) {
                case 'name':
                    aVal = `${a.nombre} ${a.apellidos}`.toLowerCase();
                    bVal = `${b.nombre} ${b.apellidos}`.toLowerCase();
                    break;
                case 'dni':
                    aVal = a.dni || '';
                    bVal = b.dni || '';
                    break;
                case 'lastFichaje':
                    const aFichaje = this.fichajes.filter(f => f.userId === a.id).sort((x, y) => new Date(y.date) - new Date(x.date))[0];
                    const bFichaje = this.fichajes.filter(f => f.userId === b.id).sort((x, y) => new Date(y.date) - new Date(x.date))[0];
                    aVal = aFichaje ? aFichaje.date : '';
                    bVal = bFichaje ? bFichaje.date : '';
                    break;
            }

            if (aVal < bVal) return -1 * direction;
            if (aVal > bVal) return 1 * direction;
            return 0;
        });

        this.renderEmployeeList();
    }

    setupBulkActions() {
        const bulkBtn = document.getElementById('bulkGeneratePDF');
        if (!bulkBtn) return;

        bulkBtn.addEventListener('click', () => {
            this.generateBulkPDFs();
        });
    }

    updateBulkActionsBar() {
        const bar = document.getElementById('bulkActionsBar');
        const count = document.getElementById('selectedCount');

        if (!bar || !count) return;

        const selectedCount = this.selectedUsers.size;

        if (selectedCount > 0) {
            bar.style.display = 'flex';
            count.textContent = `${selectedCount} seleccionado${selectedCount > 1 ? 's' : ''}`;
        } else {
            bar.style.display = 'none';
        }
    }

    async generateBulkPDFs() {
        if (this.selectedUsers.size === 0) {
            this.showToast('No hay usuarios seleccionados', 'error');
            return;
        }

        const selectedIds = Array.from(this.selectedUsers);
        this.showToast(`Generando ${selectedIds.length} PDFs...`, 'info');

        for (let i = 0; i < selectedIds.length; i++) {
            const userId = selectedIds[i];
            const user = this.users.find(u => u.id === userId);
            if (user) {
                await this.generatePDFForUser(userId);
                if (i < selectedIds.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }

        this.showToast(`✅ ${selectedIds.length} PDFs generados`, 'success');
    }

    // New admin tab functions
    exportToCSV() {
        const csvData = this.fichajes.map(f => ({
            Usuario: this.users.find(u => u.id === f.userId)?.email || '',
            Fecha: f.date,
            Entrada: f.entryTime || '',
            Salida: f.exitTime || ''
        }));

        const csv = [
            Object.keys(csvData[0]).join(','),
            ...csvData.map(row => Object.values(row).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fichajes_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();

        this.showToast('✅ CSV exportado', 'success');
    }

    async exportAllPDFs() {
        this.showToast('Generando PDFs para todos los empleados...', 'info');
        for (const user of this.users) {
            await this.generatePDFForUser(user.id);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        this.showToast(`✅ ${this.users.length} PDFs generados`, 'success');
    }

    generateCustomReport() {
        const start = document.getElementById('reportStartDate').value;
        const end = document.getElementById('reportEndDate').value;

        if (!start || !end) {
            this.showToast('Selecciona rango de fechas', 'error');
            return;
        }

        this.showToast(`Generando reporte ${start} a ${end}...`, 'info');
        // TODO: Implement custom report logic
    }

    saveConfig() {
        const config = {
            workStart: document.getElementById('workStartTime').value,
            workEnd: document.getElementById('workEndTime').value,
            holidays: document.getElementById('holidays').value
        };

        localStorage.setItem('systemConfig', JSON.stringify(config));
        this.showToast('✅ Configuración guardada', 'success');
    }

    // Quick fichaje function
    async quickFichaje() {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Check if there's already a fichaje today
        const todayFichaje = this.fichajes.find(f => f.userId === this.currentUser.id && f.date === today);

        if (!todayFichaje || !todayFichaje.entryTime) {
            // Fichar entrada
            document.getElementById('fichajeDate').value = today;
            document.getElementById('entryTime').value = currentTime;
            await this.handleFichajeSubmit(new Event('submit'));
            this.updateBigFichajeButton();
        } else if (!todayFichaje.exitTime) {
            // Fichar salida
            document.getElementById('fichajeDate').value = today;
            document.getElementById('exitTime').value = currentTime;
            await this.handleFichajeSubmit(new Event('submit'));
            this.updateBigFichajeButton();
        } else {
            this.showToast('Ya has fichado entrada y salida hoy', 'info');
        }
    }

    updateBigFichajeButton() {
        const today = new Date().toISOString().split('T')[0];
        const todayFichaje = this.fichajes.find(f => f.userId === this.currentUser.id && f.date === today);
        const btn = document.getElementById('bigFichajeBtn');
        const status = document.getElementById('fichajeStatus');

        if (!btn) return;

        if (!todayFichaje || !todayFichaje.entryTime) {
            btn.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>Fichar Entrada</span>';
            btn.classList.remove('salida');
            status.textContent = '⏰ Listo para fichar entrada';
        } else if (!todayFichaje.exitTime) {
            btn.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>Fichar Salida</span>';
            btn.classList.add('salida');
            status.textContent = '✅ Entrada registrada - Ficha tu salida';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            status.textContent = '✅ Fichaje completo hoy';
        }

        // Update hours
        this.updateTodayHours();
    }

    updateTodayHours() {
        const today = new Date().toISOString().split('T')[0];
        const todayFichaje = this.fichajes.find(f => f.userId === this.currentUser.id && f.date === today);
        const hoursEl = document.getElementById('todayHours');

        if (!hoursEl) return;

        if (todayFichaje && todayFichaje.entryTime && todayFichaje.exitTime) {
            const [entryH, entryM] = todayFichaje.entryTime.split(':').map(Number);
            const [exitH, exitM] = todayFichaje.exitTime.split(':').map(Number);
            const totalMinutes = (exitH * 60 + exitM) - (entryH * 60 + entryM);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            hoursEl.textContent = `${hours}h ${String(minutes).padStart(2, '0')}m`;
        } else {
            hoursEl.textContent = '0h 00m';
        }
    }

    // Profile Photo Handling
    setupProfilePhoto() {
        const input = document.getElementById('profilePhotoInput');
        if (!input) return;

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target.result;
                    this.updateProfilePhotoUI(result);
                    // Save to user profile (mock)
                    this.currentUser.photo = result;
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    this.showToast('✅ Foto actualizada', 'success');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    updateProfilePhotoUI(src) {
        const img = document.getElementById('settingsProfileImg');
        const placeholder = document.getElementById('settingsProfilePlaceholder');
        if (img && placeholder) {
            img.src = src;
            img.style.display = 'block';
            placeholder.style.display = 'none';
        }
    }
    // Admin Settings & Companies
    async loadAdminSettings() {
        if (!this.currentUser || (this.currentUser.role || '').toLowerCase() !== 'admin') return;

        try {
            const res = await this.api.getCompanies();
            if (res.success) {
                this.companies = res.companies;
                this.renderCompaniesList();
            }
        } catch (e) {
            console.error(e);
            this.showToast('Error cargando empresas', 'error');
        }
    }

    renderCompaniesList() {
        const container = document.getElementById('companiesList');
        if (!container) return;

        if (this.companies.length === 0) {
            container.innerHTML = '<p style="color:white; opacity:0.7; text-align:center;">No hay empresas registradas.</p>';
            return;
        }

        container.innerHTML = this.companies.map(c => `
            <div class="glass-card" style="padding:15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div style="flex:1;">
                    <h4 style="margin:0 0 4px 0; font-weight:bold; color:white;">${c.name}</h4>
                    <div style="font-size:12px; opacity:0.7; color:white;">CIF: ${c.cif}</div>
                    ${c.sealImage ? '<span style="font-size:10px; color:#4CD964;">✓ Sello subido</span>' : '<span style="font-size:10px; color:#FF3B30;">⚠ Sin sello</span>'}
                </div>
                <div style="display:flex; gap:8px;">
                     <button class="glass-button icon-btn small" onclick="window.app.showCompanyModal('${c.id}')">✏️</button>
                     <button class="glass-button icon-btn small danger" onclick="window.app.deleteCompany('${c.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    showCompanyModal(id = null) {
        const modal = document.getElementById('companyModal');
        modal.classList.add('show');

        const form = document.getElementById('companyForm');
        form.reset();
        document.getElementById('companyId').value = '';
        document.getElementById('compSealPreview').innerHTML = '';
        document.getElementById('companyModalTitle').textContent = 'Nueva Empresa';

        if (id) {
            const company = this.companies.find(c => c.id === id);
            if (company) {
                document.getElementById('companyModalTitle').textContent = 'Editar Empresa';
                document.getElementById('companyId').value = company.id;
                document.getElementById('compName').value = company.name;
                document.getElementById('compCif').value = company.cif;
                document.getElementById('compAddress').value = company.address || '';
                document.getElementById('compCcc').value = company.ccc || '';
                if (company.sealImage) {
                    // Check if it's base64 or path
                    const src = company.sealImage.startsWith('data:') ? company.sealImage : `api/get_signature.php?file=${company.sealImage}`;
                    // Actually api/upload.php returns relative path in 'path', but view_url is 'api/get_signature.php...'
                    // Wait, my saveCompany needs to handle this.
                    // For now, assume sealImage is base64 if small, or we treat it as valid src.
                    // If it is just a filename, prepend correct path? 
                    // My previous logic in upload.php returns view_url.
                    // If I manually impl upload here, I get base64. 

                    document.getElementById('compSealPreview').innerHTML = `<img src="${company.sealImage}" style="width:100px; height:auto; border-radius:4px;">`;
                }
            }
        }

        form.onsubmit = (e) => this.handleSaveCompany(e);
    }

    closeCompanyModal() {
        document.getElementById('companyModal').classList.remove('show');
    }

    async handleSaveCompany(e) {
        e.preventDefault();

        const id = document.getElementById('companyId').value;
        const name = document.getElementById('compName').value;
        const cif = document.getElementById('compCif').value;
        const address = document.getElementById('compAddress').value;
        const ccc = document.getElementById('compCcc').value;
        const sealInput = document.getElementById('compSeal');

        let sealImage = '';

        // Handle Image Upload
        if (sealInput.files && sealInput.files[0]) {
            try {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(sealInput.files[0]);
                });

                // Upload to server using uploadSignature (reused for general upload)
                const uploadRes = await this.api.uploadSignature(base64);
                if (uploadRes.success) {
                    sealImage = uploadRes.view_url; // Use the URL returned by server
                } else {
                    this.showToast('Error subiendo sello', 'error');
                    return;
                }

            } catch (err) {
                console.error(err);
                this.showToast('Error leyendo imagen', 'error');
                return;
            }
        } else if (id) {
            // Keep existing if no new file
            const company = this.companies.find(c => c.id === id);
            if (company) sealImage = company.sealImage;
        }

        const data = { id: id || undefined, name, cif, address, ccc, sealImage };

        const res = await this.api.saveCompany(data);
        if (res.success) {
            this.showToast('Empresa guardada', 'success');
            this.closeCompanyModal();
            this.loadAdminSettings();
        } else {
            this.showToast(res.message || 'Error', 'error');
        }
    }

    async deleteCompany(id) {
        if (!confirm('¿Borrar empresa?')) return;
        const res = await this.api.deleteCompany(id);
        if (res.success) {
            this.loadAdminSettings();
        } else {
            this.showToast(res.message, 'error');
        }
    }

    // User Edit Modal
    async showUserEditModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        // Ensure companies are loaded
        if (this.companies.length === 0) {
            const res = await this.api.getCompanies();
            if (res.success) this.companies = res.companies;
        }

        const modal = document.getElementById('userEditModal');
        modal.classList.add('show');

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editNombre').value = user.nombre || '';
        document.getElementById('editApellidos').value = user.apellidos || '';
        document.getElementById('editDni').value = user.dni || '';
        document.getElementById('editEmail').value = user.email || '';

        // Populate Company Select
        const select = document.getElementById('editCompanyId');
        select.innerHTML = '<option value="">ALBALUZ (Por defecto)</option>' +
            this.companies.map(c => `<option value="${c.id}" ${user.companyProfileId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');

        document.getElementById('userEditForm').onsubmit = (e) => this.handleUserEditSave(e);
    }

    closeUserEditModal() {
        document.getElementById('userEditModal').classList.remove('show');
    }

    async handleUserEditSave(e) {
        e.preventDefault();

        const data = {
            userId: document.getElementById('editUserId').value,
            nombre: document.getElementById('editNombre').value,
            apellidos: document.getElementById('editApellidos').value,
            dni: document.getElementById('editDni').value,
            email: document.getElementById('editEmail').value,
            companyProfileId: document.getElementById('editCompanyId').value
        };

        const res = await this.api.adminUpdateUser(data);
        if (res.success) {
            this.showToast('Usuario actualizado', 'success');
            this.closeUserEditModal();
            this.loadAdminData(); // Refresh list
        } else {
            this.showToast(res.message || 'Error', 'error');
        }
    }
}
document.addEventListener('DOMContentLoaded', () => { window.app = new FichajeApp(); });
// v9.6 force deploy spacing fix
