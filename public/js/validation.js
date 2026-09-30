/**
 * MetroVerify - Strict Client-Side Form Validation
 */

document.addEventListener('DOMContentLoaded', () => {

    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const MOBILE_REGEX = /^[6-9]\d{9}$/;
    const PINCODE_REGEX = /^\d{6}$/;

    function setError(input, message) {
        input.classList.add('is-invalid');
        let feedback = input.parentElement.querySelector('.invalid-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            input.parentElement.appendChild(feedback);
        }
        feedback.textContent = message;
        feedback.style.display = 'block';
    }

    function clearError(input) {
        input.classList.remove('is-invalid');
        const feedback = input.parentElement.querySelector('.invalid-feedback');
        if (feedback) feedback.style.display = 'none';
    }

    // 1. Merchant Registration Validation
    const regForm = document.getElementById('registerForm');
    if (regForm) {
        regForm.addEventListener('submit', (e) => {
            let isValid = true;

            const gstin = document.getElementById('gstin');
            const mobile = document.getElementById('mobile');
            const pincode = document.getElementById('pincode');
            const pass = document.getElementById('password');
            const confirmPass = document.getElementById('confirm_password');

            // GSTIN
            if (gstin) {
                const val = gstin.value.trim().toUpperCase();
                if (!GSTIN_REGEX.test(val)) {
                    setError(gstin, 'Please enter a valid 15-character Indian GSTIN (e.g. 07AAAAA0000A1Z5).');
                    isValid = false;
                } else {
                    clearError(gstin);
                }
            }

            // Mobile
            if (mobile) {
                const val = mobile.value.trim();
                if (!MOBILE_REGEX.test(val)) {
                    setError(mobile, 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
                    isValid = false;
                } else {
                    clearError(mobile);
                }
            }

            // Pincode
            if (pincode) {
                const val = pincode.value.trim();
                if (!PINCODE_REGEX.test(val)) {
                    setError(pincode, 'Pincode must be exactly 6 digits.');
                    isValid = false;
                } else {
                    clearError(pincode);
                }
            }

            // Passwords
            if (pass && confirmPass) {
                if (pass.value.length < 6) {
                    setError(pass, 'Password must be at least 6 characters.');
                    isValid = false;
                } else {
                    clearError(pass);
                }

                if (pass.value !== confirmPass.value) {
                    setError(confirmPass, 'Passwords do not match.');
                    isValid = false;
                } else {
                    clearError(confirmPass);
                }
            }

            if (!isValid) {
                e.preventDefault();
            }
        });
    }

    // 2. Instrument Form Validation
    const instForm = document.getElementById('instrumentForm');
    if (instForm) {
        instForm.addEventListener('submit', (e) => {
            let isValid = true;

            const maxCap = document.getElementById('max_capacity');
            const minCap = document.getElementById('min_capacity');
            const eVal = document.getElementById('e_value');
            const year = document.getElementById('year_of_manufacture');

            const maxVal = parseFloat(maxCap?.value);
            const minVal = parseFloat(minCap?.value);
            const eNum = parseFloat(eVal?.value);
            const yrNum = parseInt(year?.value, 10);
            const currentYear = new Date().getFullYear();

            if (maxCap && (isNaN(maxVal) || maxVal <= 0)) {
                setError(maxCap, 'Maximum capacity must be greater than zero.');
                isValid = false;
            } else if (maxCap) {
                clearError(maxCap);
            }

            if (minCap && (isNaN(minVal) || minVal < 0)) {
                setError(minCap, 'Minimum capacity cannot be negative.');
                isValid = false;
            } else if (minCap && minVal >= maxVal) {
                setError(minCap, 'Minimum capacity must be strictly less than maximum capacity.');
                isValid = false;
            } else if (minCap) {
                clearError(minCap);
            }

            if (eVal && (isNaN(eNum) || eNum <= 0)) {
                setError(eVal, 'Verification scale interval (e) must be positive.');
                isValid = false;
            } else if (eVal) {
                clearError(eVal);
            }

            if (year && (isNaN(yrNum) || yrNum < 1970 || yrNum > currentYear)) {
                setError(year, `Year of manufacture must be between 1970 and ${currentYear}.`);
                isValid = false;
            } else if (year) {
                clearError(year);
            }

            if (!isValid) {
                e.preventDefault();
            }
        });
    }

    // 3. New Application Form Validation
    const appForm = document.getElementById('newApplicationForm');
    if (appForm) {
        appForm.addEventListener('submit', (e) => {
            let isValid = true;

            // Checked instruments
            const checked = appForm.querySelectorAll('input[name="instruments"]:checked');
            const instContainer = document.getElementById('instrumentsContainer');
            if (checked.length === 0) {
                alert('Please select at least one instrument for verification.');
                isValid = false;
            }

            // Preferred date >= tomorrow
            const prefDate = document.getElementById('preferred_date');
            if (prefDate) {
                const selected = new Date(prefDate.value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (!prefDate.value || selected < today) {
                    setError(prefDate, 'Please select a valid upcoming date.');
                    isValid = false;
                } else {
                    clearError(prefDate);
                }
            }

            // Document file size & format
            const docInput = document.getElementById('document');
            if (docInput && docInput.files.length > 0) {
                const file = docInput.files[0];
                const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
                const fileExt = file.name.split('.').pop().toLowerCase();

                if (!allowedExts.includes(fileExt)) {
                    setError(docInput, 'Invalid file format. Please upload a PDF, JPG, or PNG document.');
                    isValid = false;
                } else if (file.size > 2 * 1024 * 1024) {
                    setError(docInput, 'File size exceeds 2 MB limit. Please compress or select a smaller file.');
                    isValid = false;
                } else {
                    clearError(docInput);
                }
            } else if (docInput) {
                setError(docInput, 'Please upload an invoice or previous verification certificate.');
                isValid = false;
            }

            if (!isValid) {
                e.preventDefault();
            }
        });
    }
});
