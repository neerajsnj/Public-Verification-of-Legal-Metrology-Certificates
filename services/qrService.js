const QRCode = require('qrcode');

/**
 * Generates a QR Code as a Data URL (base64)
 * @param {string} text 
 * @returns {Promise<string>}
 */
async function generateQRDataURL(text) {
    try {
        return await QRCode.toDataURL(text, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 250,
            color: {
                dark: '#0B2545',
                light: '#FFFFFF'
            }
        });
    } catch (err) {
        console.error('Error generating QR Data URL:', err);
        throw err;
    }
}

/**
 * Generates a QR Code as a PNG Buffer
 * @param {string} text 
 * @returns {Promise<Buffer>}
 */
async function generateQRBuffer(text) {
    try {
        return await QRCode.toBuffer(text, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 200,
            color: {
                dark: '#0B2545',
                light: '#FFFFFF'
            }
        });
    } catch (err) {
        console.error('Error generating QR Buffer:', err);
        throw err;
    }
}

module.exports = {
    generateQRDataURL,
    generateQRBuffer
};
