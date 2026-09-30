/**
 * MetroVerify - Legal Metrology Test Readings Calculator & MPE Tolerance Verifier
 */

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('testReadingsBody');
    const addRowBtn = document.getElementById('addReadingRowBtn');
    const toleranceInput = document.getElementById('tolerance_limit');
    const maxErrorInput = document.getElementById('max_error');
    const readingsJsonInput = document.getElementById('readings_json');
    const decisionRadios = document.querySelectorAll('input[name="decision"]');
    const rejectionBox = document.getElementById('rejectionReasonBox');
    const rejectionTextarea = document.getElementById('rejection_reason');
    const toleranceAlert = document.getElementById('toleranceExceededAlert');

    if (!tableBody) return;

    // Toggle Rejection Reason Box
    decisionRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'fail' && radio.checked) {
                if (rejectionBox) rejectionBox.style.display = 'block';
                if (rejectionTextarea) rejectionTextarea.required = true;
            } else {
                if (rejectionBox) rejectionBox.style.display = 'none';
                if (rejectionTextarea) rejectionTextarea.required = false;
            }
        });
    });

    // Calculate Row Error & Update Summary
    function recalculate() {
        const rows = tableBody.querySelectorAll('tr');
        const tol = parseFloat(toleranceInput?.value) || 1.0;
        let maxObservedError = 0.0;
        let anyFailed = false;
        const readingsArray = [];

        rows.forEach((row, index) => {
            const nominalInput = row.querySelector('.nominal-input');
            const observedInput = row.querySelector('.observed-input');
            const errorDisplay = row.querySelector('.error-display');
            const statusBadge = row.querySelector('.status-badge');

            const nominal = parseFloat(nominalInput?.value);
            const observed = parseFloat(observedInput?.value);

            if (!isNaN(nominal) && !isNaN(observed)) {
                const error = parseFloat((observed - nominal).toFixed(4));
                const absError = Math.abs(error);

                if (absError > maxObservedError) {
                    maxObservedError = absError;
                }

                const isPass = absError <= tol;
                if (!isPass) anyFailed = true;

                if (errorDisplay) {
                    errorDisplay.textContent = (error >= 0 ? '+' : '') + error.toFixed(3);
                }

                if (statusBadge) {
                    if (isPass) {
                        statusBadge.className = 'status-badge badge badge-pass';
                        statusBadge.textContent = 'PASS';
                    } else {
                        statusBadge.className = 'status-badge badge badge-fail';
                        statusBadge.textContent = 'FAIL (MPE EXCEEDED)';
                    }
                }

                readingsArray.push({
                    nominalLoad: nominal,
                    observedReading: observed,
                    error: error,
                    tolerance: tol,
                    pass: isPass
                });
            }
        });

        // Update Max Error Hidden / Visible Input
        if (maxErrorInput) {
            maxErrorInput.value = maxObservedError.toFixed(3);
        }

        // Update JSON
        if (readingsJsonInput) {
            readingsJsonInput.value = JSON.stringify(readingsArray);
        }

        // Auto-flag alert if tolerance exceeded
        if (toleranceAlert) {
            if (anyFailed) {
                toleranceAlert.style.display = 'block';
                toleranceAlert.innerHTML = `⚠️ <strong>Tolerance Exceeded:</strong> One or more test points exceed the maximum permissible error (±${tol}). Consider rejecting or ordering recalibration.`;
                // Suggest reject
                const rejectRadio = document.querySelector('input[name="decision"][value="fail"]');
                if (rejectRadio) {
                    rejectRadio.checked = true;
                    if (rejectionBox) rejectionBox.style.display = 'block';
                    if (rejectionTextarea && !rejectionTextarea.value) {
                        rejectionTextarea.value = `Observed error (${maxObservedError.toFixed(3)}) exceeds maximum permissible error limit (±${tol}).`;
                    }
                }
            } else {
                toleranceAlert.style.display = 'none';
            }
        }
    }

    // Attach listeners to initial rows
    function attachRowListeners(row) {
        row.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', recalculate);
        });

        const deleteBtn = row.querySelector('.delete-row-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (tableBody.querySelectorAll('tr').length > 1) {
                    row.remove();
                    recalculate();
                } else {
                    alert('At least one verification test reading is required.');
                }
            });
        }
    }

    tableBody.querySelectorAll('tr').forEach(attachRowListeners);

    // Add Row Handler
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            const rows = tableBody.querySelectorAll('tr');
            const rowCount = rows.length + 1;
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>#${rowCount}</td>
                <td>
                    <input type="number" step="any" class="nominal-input form-control" placeholder="e.g. 10.0" required>
                </td>
                <td>
                    <input type="number" step="any" class="observed-input form-control" placeholder="e.g. 10.002" required>
                </td>
                <td class="error-display font-mono" style="font-weight: 700;">0.000</td>
                <td>
                    <span class="status-badge badge badge-pass">PASS</span>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn btn-outline btn-sm delete-row-btn" title="Remove reading point" style="color: var(--gov-red); padding: 2px 6px;">✕</button>
                </td>
            `;
            tableBody.appendChild(newRow);
            attachRowListeners(newRow);
        });
    }

    if (toleranceInput) {
        toleranceInput.addEventListener('input', recalculate);
    }

    // Initial calculation
    recalculate();
});
