/**
 * MetroVerify - Main UI Interactions & Notification Handlers
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Notification Drawer Toggle
    const notifBtn = document.getElementById('notifBellBtn');
    const notifDrawer = document.getElementById('notifDrawer');
    const notifOverlay = document.getElementById('notifOverlay');
    const closeNotifBtn = document.getElementById('closeNotifBtn');
    const markReadBtn = document.getElementById('markReadBtn');

    function openNotifications() {
        if (notifDrawer && notifOverlay) {
            notifOverlay.style.display = 'block';
            setTimeout(() => notifDrawer.classList.add('open'), 10);
        }
    }

    function closeNotifications() {
        if (notifDrawer && notifOverlay) {
            notifDrawer.classList.remove('open');
            setTimeout(() => { notifOverlay.style.display = 'none'; }, 300);
        }
    }

    if (notifBtn) notifBtn.addEventListener('click', openNotifications);
    if (closeNotifBtn) closeNotifBtn.addEventListener('click', closeNotifications);
    if (notifOverlay) notifOverlay.addEventListener('click', closeNotifications);

    // Mark notifications as read
    if (markReadBtn) {
        markReadBtn.addEventListener('click', async () => {
            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                const res = await fetch('/api/notifications/mark-read', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': csrfToken || ''
                    }
                });
                if (res.ok) {
                    const badge = document.getElementById('notifBadge');
                    if (badge) badge.style.display = 'none';
                    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
                    markReadBtn.style.display = 'none';
                }
            } catch (err) {
                console.error('Error marking notifications read:', err);
            }
        });
    }

    // 2. Alert Dismissals
    document.querySelectorAll('.alert-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const alert = btn.closest('.alert');
            if (alert) alert.style.display = 'none';
        });
    });

    // 3. Demo Login Autofill Helpers
    document.querySelectorAll('.demo-autofill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('loginEmail');
            const passInput = document.getElementById('loginPassword');
            const roleSelect = document.getElementById('loginRole');

            const email = btn.getAttribute('data-email');
            const pass = btn.getAttribute('data-pass');
            const role = btn.getAttribute('data-role');

            if (emailInput) emailInput.value = email;
            if (passInput) passInput.value = pass;
            if (roleSelect && role) roleSelect.value = role;

            // Highlight form briefly
            const form = document.getElementById('loginForm');
            if (form) {
                form.style.outline = '2px solid #FF9933';
                setTimeout(() => { form.style.outline = 'none'; }, 600);
            }
        });
    });

    // 4. Modal Helpers
    window.openModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('open');
    };

    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('open');
    };

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('open');
        });
    });

    // 5. Checkbox cards in New Application
    document.querySelectorAll('.instrument-select-card').forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            card.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
                card.classList.toggle('selected', checkbox.checked);
            });
            // Initial state
            if (checkbox.checked) card.classList.add('selected');
        }
    });
});
