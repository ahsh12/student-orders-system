document.addEventListener('DOMContentLoaded', () => {
    checkLogin();

    const tableBody = document.querySelector('#ordersTable tbody');
    const addRowBtn = document.getElementById('addRowBtn');
    const removeBtn = document.getElementById('removeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const doneBtn = document.getElementById('doneBtn');

    const totalUsdEl = document.getElementById('totalUsd');
    const totalQtyEl = document.getElementById('totalQty');
    const totalProfitEl = document.getElementById('totalProfit');
    const orderCodeInput = document.getElementById('orderCode');

    // Data Loading
    loadData();

    // Event Listeners
    addRowBtn.addEventListener('click', () => addRow());
    removeBtn.addEventListener('click', removeSelectedRows);
    clearBtn.addEventListener('click', clearAllRows);
    doneBtn.addEventListener('click', handleDone);

    async function checkLogin() {
        try {
            const res = await fetch('/api/me');
            const data = await res.json();
            if (!data.loggedIn) {
                window.location.href = '/login';
            }
        } catch (e) {
            window.location.href = '/login';
        }
    }

    async function loadData() {
        try {
            const res = await fetch('/api/orders');
            if (res.ok) {
                const data = await res.json();
                renderTable(data);
            } else if (res.status === 401) {
                window.location.href = '/login';
            }
        } catch (err) {
            console.error('Failed to load orders', err);
        }
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        data.forEach(rowData => {
            addRow(rowData);
        });
        updateTotals();
    }

    function addRow(data = null) {
        const row = document.createElement('tr');
        const rowCount = tableBody.children.length + 1;
        const today = new Date().toLocaleDateString('en-GB');

        const values = data || {
            date: today,
            user: '', phone: '', title: '', link: '', pageName: '',
            usdPrice: '', qty: '', customerPrice: '', deposit: '', remaining: '', profit: ''
        };

        // Store ID if exists for updates
        if (data && data.id) {
            row.dataset.id = data.id;
        }

        row.innerHTML = `
            <td class="row-index">${rowCount}</td>
            <td><input type="text" name="date" value="${values.date}"></td>
            <td><input type="text" name="user" value="${values.user}" placeholder="Name"></td>
            <td><input type="tel" name="phone" value="${values.phone}" placeholder="Phone"></td>
            <td><input type="text" name="title" value="${values.title}" placeholder="Title"></td>
            <td><input type="url" name="link" value="${values.link}" placeholder="http://..."></td>
            <td><input type="text" name="pageName" value="${values.pageName}" placeholder="Page"></td>
            <td><input type="number" name="usdPrice" value="${values.usdPrice}" step="0.01" placeholder="0.00"></td>
            <td><input type="number" name="qty" value="${values.qty}" step="1" placeholder="0"></td>
            <td><input type="number" name="customerPrice" value="${values.customerPrice}" readonly></td>
            <td><input type="number" name="deposit" value="${values.deposit}" step="0.01" placeholder="0.00"></td>
            <td><input type="number" name="remaining" value="${values.remaining}" readonly></td>
            <td><input type="number" name="profit" value="${values.profit}" readonly></td>
            <td style="text-align: center;"><input type="checkbox" name="select"></td>
        `;

        // Add input listeners
        const inputs = row.querySelectorAll('input');
        inputs.forEach(input => {
            // Calculation on input
            if (['usdPrice', 'qty', 'deposit'].includes(input.name)) {
                input.addEventListener('input', () => {
                    calculateRow(row);
                    updateTotals();
                });
            }

            // Remove error styling
            input.addEventListener('input', () => input.classList.remove('input-error'));

            // Auto-save on blur (if row has ID)
            if (input.name !== 'select' && !input.readOnly) {
                input.addEventListener('blur', () => saveRow(row));
            }
        });

        tableBody.appendChild(row);
        updateRowIndices();
    }

    async function saveRow(row) {
        const id = row.dataset.id;
        if (!id) return; // Can't update if not saved to DB yet (shouldn't happen as Page 2 loads from DB)

        const inputs = {};
        row.querySelectorAll('input').forEach(input => inputs[input.name] = input.value);

        // Prepare payload
        const payload = {
            date: inputs.date,
            user: inputs.user,
            phone: inputs.phone,
            title: inputs.title,
            link: inputs.link,
            pageName: inputs.pageName,
            usdPrice: parseFloat(inputs.usdPrice) || 0,
            qty: parseFloat(inputs.qty) || 0,
            customerPrice: parseFloat(inputs.customerPrice) || 0,
            deposit: parseFloat(inputs.deposit) || 0,
            remaining: parseFloat(inputs.remaining) || 0,
            profit: parseFloat(inputs.profit) || 0
        };

        try {
            await fetch(`/api/orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            // Optional: visual indicator of save
        } catch (err) {
            console.error('Failed to save row', err);
        }
    }

    function calculateRow(row) {
        const usdPrice = parseFloat(row.querySelector('input[name="usdPrice"]').value) || 0;
        const qty = parseFloat(row.querySelector('input[name="qty"]').value) || 0;
        const deposit = parseFloat(row.querySelector('input[name="deposit"]').value) || 0;

        const base = usdPrice * 1.279;
        const serviceFee = base * 0.20;
        const qtyFee = (qty * 0.650) + 7;

        const customerPrice = base + serviceFee + qtyFee;
        const profit = serviceFee;
        const remaining = customerPrice - deposit;

        row.querySelector('input[name="customerPrice"]').value = customerPrice.toFixed(3);
        row.querySelector('input[name="remaining"]').value = remaining.toFixed(3);
        row.querySelector('input[name="profit"]').value = profit.toFixed(3);
    }

    function updateTotals() {
        let totalUsd = 0;
        let totalQty = 0;
        let totalProfit = 0;

        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            totalUsd += parseFloat(row.querySelector('input[name="usdPrice"]').value) || 0;
            totalQty += parseFloat(row.querySelector('input[name="qty"]').value) || 0;
            totalProfit += parseFloat(row.querySelector('input[name="profit"]').value) || 0;
        });

        totalUsdEl.textContent = totalUsd.toFixed(3);
        totalQtyEl.textContent = totalQty;
        totalProfitEl.textContent = totalProfit.toFixed(3);
    }

    function updateRowIndices() {
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            row.querySelector('.row-index').textContent = index + 1;
        });
    }

    async function removeSelectedRows() {
        const checkboxes = tableBody.querySelectorAll('input[name="select"]:checked');
        if (checkboxes.length === 0) return;

        if (!confirm('Delete selected rows?')) return;

        for (const cb of checkboxes) {
            const row = cb.closest('tr');
            const id = row.dataset.id;
            if (id) {
                await fetch(`/api/orders/${id}`, { method: 'DELETE' });
            }
            row.remove();
        }

        updateRowIndices();
        updateTotals();
    }

    async function clearAllRows() {
        if (confirm('Are you sure you want to clear all rows? This will empty the current processing list.')) {
            await fetch('/api/orders', { method: 'DELETE' });
            tableBody.innerHTML = '';
            updateTotals();
        }
    }

    async function handleDone() {
        const orderCode = orderCodeInput.value.trim();
        const rows = tableBody.querySelectorAll('tr');

        // Validation
        if (!orderCode) {
            alert('Please enter an Order Code.');
            return;
        }

        if (rows.length === 0) {
            alert('No orders to complete.');
            return;
        }

        let hasError = false;
        const validRows = [];

        rows.forEach(row => {
            const inputs = {};
            row.querySelectorAll('input').forEach(input => inputs[input.name] = input);

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
                // Recalculate for safety
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
            alert('Please fill all required fields.');
            return;
        }

        // Send to API to Finalize
        try {
            const response = await fetch('/api/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderCode: orderCode,
                    orders: validRows,
                    totals: {
                        totalUsd: parseFloat(totalUsdEl.textContent),
                        totalQty: parseFloat(totalQtyEl.textContent),
                        totalProfit: parseFloat(totalProfitEl.textContent)
                    }
                })
            });

            if (response.ok) {
                alert('تم اعتماد الطلب وإرساله إلى صفحة الأرشيف.\nOrder finalized and archived successfully!');
                tableBody.innerHTML = '';
                orderCodeInput.value = '';
                updateTotals();
                // window.location.href = 'page3.html';
            } else {
                alert('Failed to finalize order.');
            }
        } catch (err) {
            console.error('Error finalizing:', err);
            alert('Error connecting to server.');
        }
    }
});
