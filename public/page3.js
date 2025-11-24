document.addEventListener('DOMContentLoaded', () => {
    checkLogin();

    const archiveContainer = document.getElementById('archiveContainer');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const clearArchiveBtn = document.getElementById('clearArchiveBtn');

    // Hide clear button as it's dangerous and not in API spec for now, or we can implement if needed.
    // The user spec didn't explicitly ask for "Clear Archive" API, but the button was there.
    // We'll leave it but maybe disable it or implement it later.
    clearArchiveBtn.style.display = 'none';

    renderArchive();

    downloadPdfBtn.addEventListener('click', generatePDF);

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

    async function renderArchive() {
        try {
            const res = await fetch('/api/archive');
            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }
            if (!res.ok) return;
            const archives = await res.json();

            archiveContainer.innerHTML = '';

            if (archives.length === 0) {
                archiveContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px;">لا توجد طلبات مؤرشفة حتى الآن.<br>No archived orders found.</div>';
                return;
            }

            archives.forEach(batch => {
                const card = document.createElement('div');
                card.className = 'archive-card';

                const dateStr = new Date(batch.createdAt).toLocaleString();

                let rowsHtml = '';
                batch.orders.forEach((order, idx) => {
                    rowsHtml += `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${order.date}</td>
                            <td>${order.user}</td>
                            <td>${order.phone}</td>
                            <td>${order.title}</td>
                            <td><a href="${order.link}" target="_blank">Link</a></td>
                            <td>${order.pageName}</td>
                            <td>${order.usdPrice.toFixed(2)}</td>
                            <td>${order.qty}</td>
                            <td>${order.customerPrice.toFixed(3)}</td>
                            <td>${order.deposit.toFixed(2)}</td>
                            <td>${order.remaining.toFixed(3)}</td>
                            <td>${order.profit.toFixed(3)}</td>
                        </tr>
                    `;
                });

                card.innerHTML = `
                    <div class="archive-header">
                        <div class="archive-info">
                            <h3>Order Code: ${batch.orderCode}</h3>
                            <div class="archive-meta">Created: ${dateStr}</div>
                        </div>
                        <div class="archive-totals" style="text-align: right;">
                            <div><strong>Total USD:</strong> ${batch.totalUsd.toFixed(3)}</div>
                            <div><strong>Total Qty:</strong> ${batch.totalQty}</div>
                            <div style="color: var(--primary-color);"><strong>Total Profit:</strong> ${batch.totalProfit.toFixed(3)}</div>
                            <button class="btn-delete-batch" style="margin-top: 10px; background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete Batch</button>
                        </div>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Date</th>
                                    <th>User</th>
                                    <th>Phone</th>
                                    <th>Title</th>
                                    <th>Link</th>
                                    <th>Page</th>
                                    <th>USD</th>
                                    <th>Qty</th>
                                    <th>Cust. Price</th>
                                    <th>Deposit</th>
                                    <th>Remaining</th>
                                    <th>Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                `;

                // Add delete listener
                const deleteBtn = card.querySelector('.btn-delete-batch');
                deleteBtn.addEventListener('click', () => deleteBatch(batch.batchId));

                archiveContainer.appendChild(card);
            });
        } catch (err) {
            console.error('Error loading archive:', err);
        }
    }

    async function deleteBatch(batchId) {
        if (!confirm('Are you sure you want to delete this batch permanently?')) return;

        try {
            const res = await fetch(`/api/archive/${batchId}`, { method: 'DELETE' });
            if (res.ok) {
                renderArchive(); // Reload
            } else {
                alert('Failed to delete batch');
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting batch');
        }
    }

    async function generatePDF() {
        const { jsPDF } = window.jspdf;

        const controls = document.querySelector('.controls');
        const nav = document.querySelector('.nav-links');
        controls.style.display = 'none';
        nav.style.display = 'none';

        try {
            const canvas = await html2canvas(document.body, {
                scale: 2,
                useCORS: true,
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

            if (pdfImgHeight > pdfHeight) {
                let heightLeft = pdfImgHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft >= 0) {
                    position = heightLeft - pdfImgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
                    heightLeft -= pdfHeight;
                }
            } else {
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfImgHeight);
            }

            pdf.save('orders-archive.pdf');

        } catch (err) {
            console.error('PDF generation failed', err);
            alert('Failed to generate PDF.');
        } finally {
            controls.style.display = 'flex';
            nav.style.display = 'flex';
        }
    }
});
