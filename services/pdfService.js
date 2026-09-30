const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const qrService = require('./qrService');

/**
 * Generates an official Legal Metrology Certificate PDF
 * @param {Object} certData 
 * @param {string} hostUrl - Base URL for QR code verification link
 * @returns {Promise<string>} relative filepath
 */
async function generateCertificatePDF(certData, hostUrl = 'http://localhost:3000') {
    return new Promise(async (resolve, reject) => {
        try {
            const certNo = certData.cert_no;
            const filename = `${certNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
            const certsDir = path.join(__dirname, '../uploads/certificates');
            if (!fs.existsSync(certsDir)) {
                fs.mkdirSync(certsDir, { recursive: true });
            }
            const fullPath = path.join(certsDir, filename);
            const relativePath = `/uploads/certificates/${filename}`;

            const doc = new PDFDocument({
                size: 'A4',
                layout: 'portrait',
                margin: 36
            });

            const stream = fs.createWriteStream(fullPath);
            doc.pipe(stream);

            const verifyUrl = `${hostUrl}/verify/${certNo}`;
            const qrBuffer = await qrService.generateQRBuffer(verifyUrl);

            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;

            // Outer Government Border
            doc.rect(20, 20, pageWidth - 40, pageHeight - 40)
               .lineWidth(3)
               .strokeColor('#0B2545')
               .stroke();

            // Inner Decorative Border
            doc.rect(25, 25, pageWidth - 50, pageHeight - 50)
               .lineWidth(1)
               .strokeColor('#FF9933')
               .stroke();

            // Top Header Tricolor Accent Stripe
            doc.rect(26, 26, pageWidth - 52, 6)
               .fill('#FF9933');
            doc.rect(26, 32, pageWidth - 52, 4)
               .fill('#FFFFFF');
            doc.rect(26, 36, pageWidth - 52, 6)
               .fill('#138808');

            let y = 52;

            // Government Header
            doc.fillColor('#0B2545')
               .font('Helvetica-Bold')
               .fontSize(14)
               .text('GOVERNMENT OF INDIA', 36, y, { align: 'center', width: pageWidth - 72 });
            y += 18;

            doc.fillColor('#333333')
               .font('Helvetica-Bold')
               .fontSize(11)
               .text('MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION', 36, y, { align: 'center', width: pageWidth - 72 });
            y += 15;

            doc.fillColor('#0B2545')
               .font('Helvetica-Bold')
               .fontSize(12)
               .text('DIRECTORATE OF LEGAL METROLOGY', 36, y, { align: 'center', width: pageWidth - 72 });
            y += 14;

            doc.fillColor('#666666')
               .font('Helvetica')
               .fontSize(9)
               .text('[Under Section 24 of The Legal Metrology Act, 2009 & Rule 27 of Legal Metrology (General) Rules, 2011]', 36, y, { align: 'center', width: pageWidth - 72 });
            y += 18;

            // Certificate Title Banner
            doc.rect(36, y, pageWidth - 72, 28)
               .fill('#0B2545');

            doc.fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .fontSize(13)
               .text('CERTIFICATE OF VERIFICATION', 36, y + 7, { align: 'center', width: pageWidth - 72 });
            y += 36;

            // QR Code & Certificate Badge Header Section
            const certBoxY = y;
            doc.rect(36, certBoxY, pageWidth - 72 - 130, 80)
               .fillAndStroke('#F8FAFC', '#E2E8F0');

            doc.fillColor('#0B2545')
               .font('Helvetica-Bold')
               .fontSize(11)
               .text('CERTIFICATE NUMBER:', 48, certBoxY + 12);
            
            doc.fillColor('#C53030')
               .font('Helvetica-Bold')
               .fontSize(13)
               .text(certNo, 190, certBoxY + 10);

            doc.fillColor('#4A5568')
               .font('Helvetica')
               .fontSize(9.5)
               .text(`Date of Issue: `, 48, certBoxY + 34)
               .font('Helvetica-Bold')
               .text(new Date(certData.issued_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 130, certBoxY + 34);

            doc.fillColor('#4A5568')
               .font('Helvetica')
               .fontSize(9.5)
               .text(`Valid Until: `, 48, certBoxY + 54)
               .font('Helvetica-Bold')
               .fillColor('#15803D')
               .text(new Date(certData.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 130, certBoxY + 54);

            doc.fillColor('#4A5568')
               .font('Helvetica')
               .fontSize(9.5)
               .text(`Jurisdiction: `, 280, certBoxY + 34)
               .font('Helvetica-Bold')
               .text(`${certData.district || 'Central'}, ${certData.state || 'Delhi'}`, 355, certBoxY + 34);

            doc.fillColor('#4A5568')
               .font('Helvetica')
               .fontSize(9.5)
               .text(`Verification Type: `, 280, certBoxY + 54)
               .font('Helvetica-Bold')
               .text(certData.app_type || 'Initial Verification', 375, certBoxY + 54);

            // Embed QR Code
            doc.image(qrBuffer, pageWidth - 146, certBoxY, { fit: [80, 80] });
            doc.fontSize(7.5)
               .fillColor('#4A5568')
               .text('Scan for Public Verification', pageWidth - 165, certBoxY + 84, { width: 118, align: 'center' });

            y = certBoxY + 100;

            // Merchant / Establishment Details Section
            doc.rect(36, y, pageWidth - 72, 20)
               .fill('#133E87');
            doc.fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .fontSize(10)
               .text('1. DETAILS OF THE APPLICANT / ESTABLISHMENT', 44, y + 5);
            y += 20;

            doc.rect(36, y, pageWidth - 72, 60)
               .strokeColor('#CBD5E1')
               .stroke();

            doc.font('Helvetica')
               .fontSize(9)
               .fillColor('#64748B')
               .text('Business / Trading Name:', 46, y + 8)
               .fillColor('#0F172A')
               .font('Helvetica-Bold')
               .text(certData.business_name || 'N/A', 175, y + 8);

            doc.font('Helvetica')
               .fontSize(9)
               .fillColor('#64748B')
               .text('Authorized Representative:', 46, y + 24)
               .fillColor('#0F172A')
               .font('Helvetica-Bold')
               .text(certData.merchant_name || 'N/A', 175, y + 24);

            doc.font('Helvetica')
               .fontSize(9)
               .fillColor('#64748B')
               .text('GSTIN:', 350, y + 8)
               .fillColor('#0F172A')
               .font('Helvetica-Bold')
               .text(certData.gstin || 'N/A', 400, y + 8);

            doc.font('Helvetica')
               .fontSize(9)
               .fillColor('#64748B')
               .text('Registered Premises:', 46, y + 40)
               .fillColor('#0F172A')
               .font('Helvetica-Bold')
               .text(`${certData.address || ''}, ${certData.district || ''}, ${certData.state || ''} - ${certData.pincode || ''}`, 175, y + 40, { width: 330 });

            y += 68;

            // Instrument Specifications Section
            doc.rect(36, y, pageWidth - 72, 20)
               .fill('#133E87');
            doc.fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .fontSize(10)
               .text('2. PARTICULARS OF WEIGHING OR MEASURING INSTRUMENT', 44, y + 5);
            y += 20;

            doc.rect(36, y, pageWidth - 72, 94)
               .strokeColor('#CBD5E1')
               .stroke();

            // Grid layout for instrument specs
            const specs = [
                ['Instrument Category / Type:', certData.type || 'N/A', 'Serial Number:', certData.serial_no || 'N/A'],
                ['Make & Model:', certData.make_model || 'N/A', 'Accuracy Class:', certData.accuracy_class || 'Class III'],
                ['Maximum Capacity (Max):', `${certData.max_capacity} ${certData.capacity_unit || 'kg'}`, 'Minimum Capacity (Min):', `${certData.min_capacity} ${certData.capacity_unit || 'kg'}`],
                ['Verification Scale Interval (e):', `${certData.e_value} g`, 'Year of Manufacture:', `${certData.year_of_manufacture || '2025'}`],
                ['Location of Instrument:', certData.location || 'Main Counter', 'Application Number:', certData.application_no || 'N/A']
            ];

            let rowY = y + 6;
            specs.forEach(row => {
                doc.font('Helvetica').fontSize(8.5).fillColor('#64748B').text(row[0], 46, rowY);
                doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A').text(row[1], 180, rowY, { width: 140 });

                doc.font('Helvetica').fontSize(8.5).fillColor('#64748B').text(row[2], 330, rowY);
                doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A').text(row[3], 445, rowY, { width: 100 });
                rowY += 17;
            });

            y += 102;

            // Test Summary Section
            doc.rect(36, y, pageWidth - 72, 20)
               .fill('#133E87');
            doc.fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .fontSize(10)
               .text('3. VERIFICATION & METROLOGICAL TEST SUMMARY', 44, y + 5);
            y += 20;

            doc.rect(36, y, pageWidth - 72, 70)
               .strokeColor('#CBD5E1')
               .stroke();

            doc.font('Helvetica')
               .fontSize(8.5)
               .fillColor('#334155')
               .text(
                   'The weighing/measuring instrument described above has been thoroughly inspected, tested with calibrated reference standards traceable to the National Prototype Standards (NPL/RRSL), and verified in accordance with the Legal Metrology (General) Rules, 2011.',
                   46, y + 8, { width: pageWidth - 92, align: 'justify' }
               );

            doc.font('Helvetica-Bold')
               .fontSize(9)
               .fillColor('#15803D')
               .text(`Test Result: VERIFIED & PASSED (Within Maximum Permissible Error)`, 46, y + 36);

            doc.font('Helvetica')
               .fontSize(8.5)
               .fillColor('#475569')
               .text(`Maximum Observed Error: `, 46, y + 50)
               .font('Helvetica-Bold')
               .text(`${certData.max_error != null ? certData.max_error : '0.000'} g (MPE Tolerance: ±${certData.tolerance_limit || '1.0'} g)`, 180, y + 50);

            y += 78;

            // Certification Declaration & Signatures
            doc.rect(36, y, pageWidth - 72, 85)
               .fillAndStroke('#F1F5F9', '#CBD5E1');

            doc.font('Helvetica-Oblique')
               .fontSize(8)
               .fillColor('#334155')
               .text(
                   'I hereby certify that the weighing and measuring instrument specified above conforms to the provisions of the Legal Metrology Act, 2009 and Rules made thereunder and has been verified and stamped accordingly.',
                   46, y + 8, { width: pageWidth - 92 }
               );

            // Officer Stamp Box
            const signY = y + 30;
            doc.font('Helvetica-Bold')
               .fontSize(9)
               .fillColor('#0B2545')
               .text(certData.inspector_name || 'Inspector of Legal Metrology', 46, signY);

            doc.font('Helvetica')
               .fontSize(8)
               .fillColor('#475569')
               .text(`Designation: ${certData.inspector_designation || 'Inspector of Legal Metrology'}`, 46, signY + 12)
               .text(`Employee ID: ${certData.employee_id || 'LM-OFF-2024'}`, 46, signY + 23)
               .text(`District: ${certData.district || 'Central'} Zone`, 46, signY + 34);

            // Digital Security Seal badge on right
            doc.circle(pageWidth - 95, signY + 20, 26)
               .lineWidth(1.5)
               .strokeColor('#0B2545')
               .stroke();

            doc.font('Helvetica-Bold')
               .fontSize(6.5)
               .fillColor('#0B2545')
               .text('LEGAL METROLOGY', pageWidth - 130, signY + 6, { width: 70, align: 'center' })
               .text('★ VERIFIED ★', pageWidth - 130, signY + 17, { width: 70, align: 'center' })
               .text('GOVT OF INDIA', pageWidth - 130, signY + 28, { width: 70, align: 'center' });

            y += 94;

            // Statutory Warning Notice Footer
            doc.rect(36, y, pageWidth - 72, 32)
               .fill('#FEF2F2');
            doc.rect(36, y, pageWidth - 72, 32)
               .strokeColor('#F87171')
               .stroke();

            doc.font('Helvetica-Bold')
               .fontSize(7.5)
               .fillColor('#991B1B')
               .text('STATUTORY NOTICE:', 44, y + 5);

            doc.font('Helvetica')
               .fontSize(7)
               .fillColor('#7F1D1D')
               .text(
                   'This digital certificate must be displayed prominently at the place of use. Under Section 44 of the Legal Metrology Act, 2009, use of unverified or tampered instruments is a punishable offense with fine up to ₹25,000 and/or imprisonment. Scan the QR code to verify authenticity in real-time.',
                   44, y + 15, { width: pageWidth - 88 }
               );

            doc.end();

            stream.on('finish', () => {
                resolve(relativePath);
            });

            stream.on('error', (err) => {
                reject(err);
            });

        } catch (err) {
            console.error('Error generating PDF Certificate:', err);
            reject(err);
        }
    });
}

module.exports = {
    generateCertificatePDF
};
