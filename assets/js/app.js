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
}

// MAIN APP
class FichajeApp {
    constructor() {
        this.api = new ApiService();
        this.currentUser = null;
        this.fichajes = [];
        this.users = [];
        this.currentView = 'login';
        this.currentMonth = new Date();
        this.signaturePad = null;
        this.entrySignaturePad = null;
        this.exitSignaturePad = null;
        window.app = this; // Expose for admin onclick handlers
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initMainSignaturePad();
        this.initDailySignaturePads();

        const session = await this.api.checkSession();
        if (session.success) {
            this.currentUser = session.user;
            this.currentUser = session.user;

            if (this.currentUser.forcePasswordChange) {
                this.showScreen('changePassword');
                return; /* Stop loading app */
            }

            await this.loadData();
            this.showApp();
            this.renderCalendar();
            this.loadTodayFichajes();
            this.updateTabIndicator();

            // Set default date to today
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('fichajeDate').value = today;

            if (this.currentUser.role === 'admin') {
                document.getElementById('adminTabBtn').style.display = 'flex';
                // Remove settings tab button and content for admins
                const settingsBtn = document.querySelector('.tab-btn[data-tab="settings"]');
                if (settingsBtn) settingsBtn.remove();

                const settingsContent = document.getElementById('settingsTab');
                if (settingsContent) settingsContent.remove();
            }
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
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('changePasswordForm').addEventListener('submit', (e) => this.handleChangePassword(e));
        document.getElementById('showRegisterBtn').addEventListener('click', () => this.showScreen('register'));
        document.getElementById('backToLoginBtn').addEventListener('click', () => this.showScreen('login'));
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        document.getElementById('registerFichajeBtn').addEventListener('click', () => this.registerFichaje());
        document.getElementById('clearEntrySig').addEventListener('click', () => this.clearDailyPad('entry'));
        document.getElementById('clearExitSig').addEventListener('click', () => this.clearDailyPad('exit'));

        document.getElementById('prevMonthBtn').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonthBtn').addEventListener('click', () => this.changeMonth(1));

        document.getElementById('clearSignatureBtn').addEventListener('click', () => this.clearMainSignature());
        document.getElementById('generatePdfBtn').addEventListener('click', () => this.generatePDF());
        document.getElementById('sharePdfBtn').addEventListener('click', () => this.sharePDF());

        document.getElementById('settingsForm').addEventListener('submit', (e) => this.handleSaveSettings(e));

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.getAttribute('data-tab'));
            });
        });

        window.addEventListener('resize', () => this.updateTabIndicator());
    }

    updateTabIndicator() {
        const activeBtn = document.querySelector('.tab-btn.active');
        const indicator = document.getElementById('tabIndicator');
        const container = document.querySelector('.tabs-container');
        if (!activeBtn || !indicator || !container) return;
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
            if (this.currentUser.role === 'admin') {
                document.getElementById('adminTabBtn').style.display = 'flex';
                // Only load admin functionality on demand inside showApp or here
                if (this.loadAdminData) setTimeout(() => this.loadAdminData(), 500);
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
            if (this.currentUser.role === 'admin') {
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
        this.switchTab('fichaje');
        this.setupInactivityMonitor();
        setTimeout(() => this.updateTabIndicator(), 50);
        if (this.currentUser.role === 'admin') {
            document.getElementById('adminTabBtn').style.display = 'flex';
            this.loadAdminData();
            setTimeout(() => this.updateTabIndicator(), 100);
        } else {
            document.getElementById('adminTabBtn').style.display = 'none';
        }
    }

    updateUserInfo() {
        if (!this.currentUser) return;

        // Handle potential key mismatch or missing data
        const nombre = this.currentUser.nombre || this.currentUser.name || 'Usuario';
        const apellidos = this.currentUser.apellidos || '';

        const initials = ((nombre[0] || '?') + (apellidos[0] || '')).toUpperCase();

        document.getElementById('userInitials').textContent = initials;
        document.getElementById('userName').textContent = `${nombre} ${apellidos}`;
        document.getElementById('userRole').textContent = this.currentUser.role === 'admin' ? 'Administrador' : 'Empleado';
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}Tab`).classList.add('active');
        this.updateTabIndicator();
        if (tabName === 'fichaje') this.loadTodayFichajes();
        else if (tabName === 'historico') this.renderCalendar();
        else if (tabName === 'admin') this.loadAdminData();
        else if (tabName === 'settings') this.loadSettingsForm();
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

        const existingIndex = this.fichajes.findIndex(f => f.userId === this.currentUser.id && f.date === date);
        if (existingIndex !== -1) {
            this.showConfirmModal(() => {
                this.processFichaje(date, entryTime, exitTime, existingIndex);
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
        document.getElementById('entryTime').value = '';
        document.getElementById('exitTime').value = '';
        this.clearDailyPad('entry');
        this.clearDailyPad('exit');
        this.loadTodayFichajes();
    }

    loadTodayFichajes() {
        const today = new Date().toISOString().split('T')[0];
        const userId = this.currentUser.id || this.currentUser.email;
        const todayFichajes = this.fichajes.filter(f => f.date === today && f.userId === userId);
        const listContainer = document.getElementById('todayList');
        if (!listContainer) return;

        if (todayFichajes.length === 0) {
            listContainer.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">No hay fichajes registrados hoy</p>';
            return;
        }

        // Sort by shift number
        todayFichajes.sort((a, b) => (a.shift || 1) - (b.shift || 1));

        listContainer.innerHTML = todayFichajes.map(f => `
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
            dateInput.value = today;
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
        const userId = this.currentUser.id || this.currentUser.email;

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
                }, 10 * 60 * 1000);
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

    _createAndDownloadPdf(user, fichajes) {
        if (!window.pdfMake) {
            this.showToast('Error: pdfmake no está cargado', 'error');
            return;
        }

        // IMPORTANT: Bind VFS fonts
        if (window.pdfMake.vfs) {
            window.pdfMake.vfs = window.pdfMake.vfs;
        }

        // Use the selected month from the app state (Historico tab)
        // instead of the current real-time date.
        const currentDate = new Date(this.currentMonth);
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Month names in Spanish
        const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const monthName = monthNames[currentMonth];

        // Last day of current month
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // 1. Header Table Data
        const headerTableBody = [
            [
                { text: 'Empresa:', bold: true, style: 'headerLabel' },
                { text: 'ALBALUZ DESARROLLOS URBANOS, S.A.', style: 'headerValue' },
                { text: 'Trabajador:', bold: true, style: 'headerLabel' },
                { text: `${user.nombre} ${user.apellidos}`.toUpperCase(), style: 'headerValue' }
            ],
            [
                { text: 'C.I.F./N.I.F.:', bold: true, style: 'headerLabel' },
                { text: 'A98543432', style: 'headerValue' },
                { text: 'N.I.F.:', bold: true, style: 'headerLabel' },
                { text: (user.dni || '').toUpperCase(), style: 'headerValue' }
            ],
            [
                { text: 'Centro de Trabajo:', bold: true, style: 'headerLabel' },
                { text: 'ALBALUZ DESARROLLOS URBANOS S.A', style: 'headerValue' },
                { text: 'Nº Afiliación:', bold: true, style: 'headerLabel' },
                { text: user.afiliacion || '', style: 'headerValue' }
            ],
            [
                { text: 'C.C.C.:', bold: true, style: 'headerLabel' },
                { text: '02/1089856/19', style: 'headerValue' },
                { text: 'Mes y Año:', bold: true, style: 'headerLabel' },
                { text: `${(currentMonth + 1).toString().padStart(2, '0')}/${currentYear}`, style: 'headerValue' }
            ]
        ];

        // 2. Main Grid Data - DUAL SHIFTS
        const gridHeaderRows = [
            [
                { text: 'DIA', style: 'tableHeader', alignment: 'center', margin: [0, 8, 0, 0] },
                { text: 'HORA ENTRADA', style: 'tableHeader', colSpan: 2, alignment: 'center' },
                {},
                { text: 'HORA SALIDA', style: 'tableHeader', colSpan: 2, alignment: 'center' },
                {},
                { text: 'HORAS TOTALES', style: 'tableHeader', alignment: 'center', margin: [0, 2, 0, 0] },
                { text: 'FIRMAS ENTRADA', style: 'tableHeader', colSpan: 2, alignment: 'center' },
                {},
                { text: 'FIRMAS SALIDA', style: 'tableHeader', colSpan: 2, alignment: 'center' },
                {}
            ]
        ];

        const gridBody = [...gridHeaderRows];
        let totalHorasMensuales = 0;

        // Generate rows 1 to 31
        for (let day = 1; day <= 31; day++) {
            const checkDate = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            // Get both shifts for this day
            const dayFichajes = fichajes.filter(f => f.date === checkDate);
            const shift1 = dayFichajes.find(f => f.shift === 1) || {};
            const shift2 = dayFichajes.find(f => f.shift === 2) || {};

            let entry1 = shift1.entryTime || '';
            let exit1 = shift1.exitTime || '';
            let entry2 = shift2.entryTime || '';
            let exit2 = shift2.exitTime || '';
            let totalHours = '';

            // Calculate hours for shift 1
            let hours1 = 0;
            if (entry1 && exit1) {
                const start = new Date(`2000-01-01T${entry1}`);
                const end = new Date(`2000-01-01T${exit1}`);
                if (end > start) {
                    hours1 = (end - start) / 3600000;
                }
            }

            // Calculate hours for shift 2
            let hours2 = 0;
            if (entry2 && exit2) {
                const start = new Date(`2000-01-01T${entry2}`);
                const end = new Date(`2000-01-01T${exit2}`);
                if (end > start) {
                    hours2 = (end - start) / 3600000;
                }
            }

            // Sum total hours
            const dayTotal = hours1 + hours2;
            if (dayTotal > 0) {
                totalHorasMensuales += dayTotal;
                totalHours = dayTotal.toFixed(2);
            }

            // Signature cells
            let entry1Sig = '';
            let exit1Sig = '';
            let entry2Sig = '';
            let exit2Sig = '';

            if (shift1.entrySignature) {
                entry1Sig = { image: shift1.entrySignature, width: 20, alignment: 'center', margin: [0, 1, 0, 0] };
            }
            if (shift1.exitSignature) {
                exit1Sig = { image: shift1.exitSignature, width: 20, alignment: 'center', margin: [0, 1, 0, 0] };
            }
            if (shift2.entrySignature) {
                entry2Sig = { image: shift2.entrySignature, width: 20, alignment: 'center', margin: [0, 1, 0, 0] };
            }
            if (shift2.exitSignature) {
                exit2Sig = { image: shift2.exitSignature, width: 20, alignment: 'center', margin: [0, 1, 0, 0] };
            }

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

        // Signature Check
        let employeeSignature = { text: '' };

        if (user.mainSignature) {
            // If mainSignature is a URL/Path, we rely on generatePDF pre-processing it to base64 before calling this.
            // OR if it's already base64 (from auth/template logic)
            // In existing app structure, generatePDF does the pre-processing.
            employeeSignature = { image: user.mainSignature, width: 130, alignment: 'center' };
        }
        else if (this.signaturePad && !this.isCanvasEmpty(this.signaturePad.canvas) && user.id === (this.currentUser.id || this.currentUser.email)) {
            // Fallback to active pad for self-download
            employeeSignature = { image: this.signaturePad.canvas.toDataURL('image/png'), width: 130, alignment: 'center' };
        }

        // Document Definition
        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [20, 5, 20, 5],
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
                { text: '', margin: [0, 2] },
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
                { text: '', margin: [0, 2] },
                {
                    columns: [
                        { text: 'Firma de la empresa:', width: '50%', style: 'signatureLabel' },
                        { text: 'Firma del trabajador:', width: '50%', style: 'signatureLabel' }
                    ]
                },
                {
                    columns: [
                        { text: '', width: '50%', height: 40 },
                        employeeSignature
                    ]
                },
                { text: '', margin: [0, 0] },
                {
                    text: [
                        { text: 'En ' },
                        { text: 'ALBACETE', decoration: 'underline' },
                        { text: ', a ' },
                        { text: lastDayOfMonth.toString(), decoration: 'underline' },
                        { text: ' de ' },
                        { text: monthName, decoration: 'underline' },
                        { text: ' de ' },
                        { text: currentYear.toString(), decoration: 'underline' }
                    ],
                    alignment: 'right',
                    margin: [0, 0, 40, 2]
                },
                {
                    text: 'Registro realizado en cumplimiento de la letra h) del artículo 1 del R.D.-Ley 16/2013, de 20 de diciembre por el que se modifica el artículo 12.5 del E.T., por el que se establece que "La jornada de los trabajadores a tiempo parcial se registrará día a día y se totalizará mensualmente, entregando copia al trabajador, junto con el recibo de salarios, del resumen de todas las horas realizadas en cada mes, tanto de las ordinarias como de las complementarias en sus distintas modalidades.\n\nEl empresario deberá conservar los resúmenes mensuales de los registros de jornada durante un periodo mínimo de cuatro años. El incumplimiento empresarial de estas obligaciones de registro tendrá por consecuencia jurídica la de que el contrato se presuma celebrado a jornada completa, salvo prueba en contrario que acredite el carácter parcial de los servicios.',
                    style: 'legalText',
                    margin: [0, 2, 0, 0]
                }
            ],
            styles: {
                mainHeader: { fontSize: 13, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
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
        if (!this.currentUser || this.currentUser.role !== 'admin') return;

        this.showToast('Cargando datos de administración...', 'info');

        // Fetch fresh data
        const [usersRes, fichajesRes] = await Promise.all([
            this.api.getAllUsers(),
            this.api.getAllFichajes()
        ]);

        if (usersRes.success) {
            this.users = usersRes.users;
            // this.showToast(`Debug: ${this.users.length} usuarios cargados`);
        } else {
            this.showToast('Error cargando usuarios: ' + usersRes.message, 'error');
        }

        if (fichajesRes.success) {
            this.fichajes = fichajesRes.fichajes;
            // this.showToast(`Debug: ${this.fichajes.length} fichajes cargados`);
        } else {
            this.showToast('Error cargando fichajes: ' + fichajesRes.message, 'error');
        }

        // If 0 users, something is wrong with API or Parsing?
        if (this.users.length === 0) {
            this.showToast('Advertencia: 0 usuarios encontrados en la base de datos.', 'warning');
        }

        // Calc stats
        const totalEmployees = this.users.length;
        const today = new Date().toISOString().split('T')[0];
        const todayFichajesCount = this.fichajes.filter(f => f.date === today).length;

        document.getElementById('totalEmployees').textContent = totalEmployees;
        document.getElementById('todayFichajes').textContent = todayFichajesCount;

        // Render List
        const list = document.getElementById('employeeList');
        list.innerHTML = this.users.map(user => {
            const lastFichaje = this.fichajes
                .filter(f => f.userId === user.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

            return `
                <div class="employee-card">
                    <div style="display: flex; gap: 10px; align-items: flex-start;">
                        <div class="user-avatar" style="width: 36px; height: 36px; font-size: 14px; flex-shrink: 0;">
                            ${(user.nombre[0] + user.apellidos[0]).toUpperCase()}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 style="margin: 0 0 4px 0; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${user.nombre} ${user.apellidos}
                            </h4>
                            <p style="margin: 0; font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${user.email}
                            </p>
                            <p style="margin: 2px 0 0 0; font-size: 11px; color: var(--text-tertiary);">
                                DNI: ${user.dni || '-'} | Último: ${lastFichaje ? lastFichaje.date : 'Nunca'}
                            </p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                        <button class="download-btn" style="flex: 1; padding: 6px 8px; font-size: 11px;" onclick="window.app.resetUserPassword('${user.id}', '${user.email}')">
                            🔑 Reset
                        </button>
                        <button class="download-btn" style="flex: 1; padding: 6px 8px; font-size: 11px; background: rgba(255,59,48,0.2);" onclick="window.app.deleteUser('${user.id}', '${user.email}')">
                            🗑️ Borrar
                        </button>
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 6px;">
                        <button class="download-btn" style="flex: 1; padding: 6px 8px; font-size: 11px;" onclick="window.app.generatePDFForUser('${user.id}')">
                            📄 PDF Mes Actual
                        </button>
                        <button class="download-btn" style="flex: 1; padding: 6px 8px; font-size: 11px; background: rgba(52,199,89,0.2);" onclick="window.app.generateAllPDFsForUser('${user.id}', '${user.nombre} ${user.apellidos}')">
                            📦 PDFs Históricos
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async resetUserPassword(userId, userEmail) {
        const confirmed = confirm(`¿Resetear contraseña de ${userEmail}?\n\nSe generará una contraseña temporal: temp123456`);
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
        const confirmed = confirm(`⚠️ ¿BORRAR usuario ${userEmail}?\n\nEsta acción NO se puede deshacer.\nSe eliminarán todos sus fichajes.`);
        if (!confirmed) return;

        const doubleConfirm = confirm(`¿Estás SEGURO de borrar ${userEmail}?`);
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
            // Convert relative URLs to absolute
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
                    console.warn('Failed to load signature:', absoluteUrl, err);
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

        // Handle User Main Signature (Convert to DataURL if it's a URL/Path)
        let mainSignatureData = user.mainSignature;

        // If no main signature, use the most recent exit signature as fallback
        if (!mainSignatureData || mainSignatureData === '') {
            // Find the most recent fichaje with an exit signature
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

        const processedUser = { ...user, mainSignature: mainSignatureData };

        this._createAndDownloadPdf(processedUser, processedFichajes);
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
}
document.addEventListener('DOMContentLoaded', () => { window.app = new FichajeApp(); });
