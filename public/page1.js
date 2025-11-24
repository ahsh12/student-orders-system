document.addEventListener('DOMContentLoaded', () => {
    // Page 1 is Public - No Login Required

    const tableBody = document.querySelector('#ordersTable tbody');
    const addRowBtn = document.getElementById('addRowBtn');
    const removeBtn = document.getElementById('removeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const doneBtn = document.getElementById('doneBtn');

    // Initialize with one empty row
    addRow();

    // Event Listeners
    addRowBtn.addEventListener('click', () => addRow());
    removeBtn.addEventListener('click', removeSelectedRows);
    clearBtn.addEventListener('click', clearAllRows);
    doneBtn.addEventListener('click', handleDone);


    function addRow() {
        const row = document.createElement('tr');
        const rowCount = tableBody.children.length + 1;
        const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

        row.innerHTML = `
            <td class="row-index">${rowCount}</td>
            <td><input type="text" name="date" value="${today}" readonly></td>
            <td><input type="text" name="user" placeholder="Name"></td>
            <td><input type="tel" name="phone" placeholder="Phone"></td>
            <td><input type="text" name="title" placeholder="Title"></td>
            <td><input type="url" name="link" placeholder="http://..."></td>
            <td><input type="text" name="pageName" placeholder="Page"></td>
            <td><input type="number" name="usdPrice" step="0.01" placeholder="0.00"></td>
            <td><input type="number" name="qty" step="1" placeholder="0"></td>
            <td><input type="number" name="customerPrice" readonly></td>
            <td><input type="number" name="deposit" step="0.01" placeholder="0.00"></td>
            <td><input type="number" name="remaining" readonly></td>
            <td><input type="number" name="profit" readonly></td>
            <td style="text-align: center;"><input type="checkbox" name="select"></td>
        `;

        // Add input listeners for calculations
        const inputs = row.querySelectorAll('input');
        inputs.forEach(input => {
            if (['usdPrice', 'qty', 'deposit'].includes(input.name)) {
                input.addEventListener('input', () => calculateRow(row));
            }
            // Remove error styling on input
            input.addEventListener('input', () => input.classList.remove('input-error'));
        });

        tableBody.appendChild(row);
        updateRowIndices();
    }

    function calculateRow(row) {
        const usdPrice = parseFloat(row.querySelector('input[name="usdPrice"]').value) || 0;
        const qty = parseFloat(row.querySelector('input[name="qty"]').value) || 0;
        const deposit = parseFloat(row.querySelector('input[name="deposit"]').value) || 0;

        // Formulas
        // 1) base = usd * 1.279
        // 2) serviceFee = base * 0.20
        // 3) qtyFee = (qty * 0.650) + 7

        const base = usdPrice * 1.279;
        const serviceFee = base * 0.20;
        const qtyFee = (qty * 0.650) + 7;

        const customerPrice = base + serviceFee + qtyFee;
        const profit = serviceFee;
        const remaining = customerPrice - deposit;

        // Update fields (round to 3 decimals)
        row.querySelector('input[name="customerPrice"]').value = customerPrice.toFixed(3);
        row.querySelector('input[name="remaining"]').value = remaining.toFixed(3);
        row.querySelector('input[name="profit"]').value = profit.toFixed(3);
    }

    function updateRowIndices() {
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            row.querySelector('.row-index').textContent = index + 1;
        });
    }

    function removeSelectedRows() {
        const checkboxes = tableBody.querySelectorAll('input[name="select"]:checked');
        if (checkboxes.length === 0) {
            alert('Please select rows to remove first.');
            return;
        }

        checkboxes.forEach(cb => cb.closest('tr').remove());

        if (tableBody.children.length === 0) {
            addRow();
        } else {
            updateRowIndices();
        }
    }

    function clearAllRows() {
        if (confirm('Are you sure you want to clear all rows?')) {
            tableBody.innerHTML = '';
            addRow();
        }
    }

    async function handleDone() {
        const rows = tableBody.querySelectorAll('tr');
        const validRows = [];
        let hasError = false;

        // Reset errors
        document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

        rows.forEach(row => {
            const inputs = {};
            row.querySelectorAll('input').forEach(input => {
                inputs[input.name] = input;
            });

            // Check if row is empty (ignore auto-filled date and read-only calcs)
            const isRowEmpty = !inputs.user.value && !inputs.phone.value && !inputs.title.value &&
                !inputs.link.value && !inputs.pageName.value && !inputs.usdPrice.value &&
                !inputs.qty.value && !inputs.deposit.value;

            if (isRowEmpty) return; // Skip empty rows

            // Validate required fields
            const required = ['user', 'phone', 'title', 'link', 'pageName', 'usdPrice', 'qty', 'deposit'];
            let rowValid = true;

            required.forEach(field => {
                if (!inputs[field].value) {
                    inputs[field].classList.add('input-error');
                    rowValid = false;
                    hasError = true;
                }
            });

            if (rowValid) {
                // Ensure calculations are up to date
                calculateRow(row);

                validRows.push({
                    date: inputs.date.value,
                    user: inputs.user.value,
                    phone: inputs.phone.value,
                    title: inputs.title.value,
                    link: inputs.link.value,
                    pageName: inputs.pageName.value,
                    usdPrice: parseFloat(inputs.usdPrice.value),
                    qty: parseFloat(inputs.qty.value),
                    customerPrice: parseFloat(inputs.customerPrice.value),
                    deposit: parseFloat(inputs.deposit.value),
                    remaining: parseFloat(inputs.remaining.value),
                    profit: parseFloat(inputs.profit.value)
                });
            }
        });

        if (hasError) {
            alert('يرجى ملء جميع الحقول للصفوف المستخدمة قبل الضغط على تم.\nPlease fill all fields for used rows.');
            return;
        }

        if (validRows.length === 0) {
            alert('Please add at least one order.');
            return;
        }

        // Send to API
        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validRows)
            });

            if (response.ok) {
                alert('تم حفظ الطلبات بنجاح! البيانات جاهزة للانتقال إلى صفحة موظف الطلب.\nOrders saved successfully!');

                // Clear and reset
                tableBody.innerHTML = '';
                addRow();
            } else {
                const err = await response.json();
                alert('Error saving orders: ' + (err.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to connect to server.');
        }
    }
});
